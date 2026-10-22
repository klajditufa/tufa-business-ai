"""The JSON API used by the web interface.

Bodies are JSON and dates are YYYY-MM-DD. Requests for CIS data may name the
business in an ``X-Business`` header (an id from /api/session); without it the
active business is used.

    GET    /api/session                                  {version, active, businesses: [...]}
    POST   /api/session            {certificate, password, environment}
                                   certificate = base64 of the .p12/.pfx/.pem file; adds the
                                   business (or replaces the same certificate) and makes it active
    POST   /api/session/active     {id}                  make another loaded business active
    POST   /api/session/environment {environment}        "production" or "test"
    DELETE /api/session                                  forget the business

    POST   /api/overview           {FromDate, ToDate}    sales and purchase totals of every business

    POST   /api/v1/utilities/cis-invoices/sales          {FromDate, ToDate, Page, FIC, All}
    POST   /api/v1/utilities/cis-invoices/purchases      same as sales
    POST   /api/v1/utilities/get-taxpayers               {searchTerm}
    POST   /api/v1/utilities/get-operators               {}
    POST   /api/v1/utilities/get-business-units          {}
    POST   /api/v1/utilities/get-tcrs                    {}
    POST   /api/v1/utilities/einvoice-pdf                {EIC, PartyType}

Invoice lists are JSON arrays of CIS invoices (see convert.py); the total for
the search is in the X-Total-Count header. Errors are
``{"message", "field"?, "cisError"?, "hint"?, "unreachable"?}``.
"""

from __future__ import annotations

import base64
import binascii
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Any, Callable

from .. import convert
from ..certificate import Certificate
from ..client import PURCHASES, SALES
from ..errors import CisClientError, CisFault, ValidationError
from ..transport import ENVIRONMENTS
from .businesses import Business, Businesses
from .errors import ApiError

API_PREFIX = "/api/v1/utilities"
OVERVIEW_WORKERS = 4  # CIS searches running at the same time for the overview

Payload = Any
Headers = dict[str, str]
RouteResult = tuple[int, Payload, Headers]


@dataclass(frozen=True)
class Request:
    body: dict
    business: str | None  # X-Business header


Route = Callable[[Businesses, Request], RouteResult]


def _only(body: dict, allowed: set) -> None:
    unknown = sorted(set(body) - allowed)
    if unknown:
        raise ValidationError(f"Unknown fields found, please remove them: {', '.join(unknown)}", unknown[0])


def _optional_string(body: dict, key: str) -> str | None:
    value = body.get(key)
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise ValidationError(f"{key} must be a string", key)
    return value.strip()


# Session -----------------------------------------------------------------------


def session_get(businesses: Businesses, request: Request) -> RouteResult:
    return 200, businesses.session(), {}


def session_load(businesses: Businesses, request: Request) -> RouteResult:
    body = request.body
    _only(body, {"certificate", "password", "environment", "fileName"})
    encoded = body.get("certificate")
    if not isinstance(encoded, str) or not encoded:
        raise ValidationError("certificate is required (base64 of the .p12/.pfx file)", "certificate")
    try:
        data = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError):
        raise ValidationError("certificate must be base64 encoded", "certificate") from None
    password = body.get("password")
    if password is not None and not isinstance(password, str):
        raise ValidationError("password must be a string", "password")
    businesses.add(Certificate.from_bytes(data, password), _optional_string(body, "environment"))
    return 200, businesses.session(), {}


def session_select(businesses: Businesses, request: Request) -> RouteResult:
    _only(request.body, {"id"})
    business_id = _optional_string(request.body, "id")
    if not business_id:
        raise ValidationError("id is required", "id")
    businesses.select(business_id)
    return 200, businesses.session(), {}


def session_environment(businesses: Businesses, request: Request) -> RouteResult:
    _only(request.body, {"environment"})
    environment = _optional_string(request.body, "environment")
    if environment not in ENVIRONMENTS:
        raise ValidationError("environment must be production or test", "environment")
    businesses.add(businesses.get(request.business).certificate, environment)
    return 200, businesses.session(), {}


def session_delete(businesses: Businesses, request: Request) -> RouteResult:
    businesses.remove(request.business)
    return 200, businesses.session(), {}


# Overview ----------------------------------------------------------------------


def _error(error: Exception) -> dict:
    payload: dict = {"message": str(error)}
    if isinstance(error, CisFault):
        payload["cisError"] = error.to_dict()
    return payload


def overview(businesses: Businesses, request: Request) -> RouteResult:
    """Count, net, VAT and total of the sales and purchases of every business for one period.

    Each business is reported on its own: one failing (say CIS refuses its
    certificate) does not hide the others.
    """
    _only(request.body, {"FromDate", "ToDate"})
    from_date, to_date = _optional_string(request.body, "FromDate"), _optional_string(request.body, "ToDate")

    def totals(business: Business, kind: str) -> tuple[dict | None, dict | None]:
        try:
            return convert.totals(business.client.fetch_all_invoices(kind, from_date, to_date)), None
        except ValidationError:
            raise
        except CisClientError as error:
            return None, _error(error)

    loaded = businesses.all()
    with ThreadPoolExecutor(max_workers=OVERVIEW_WORKERS) as pool:
        jobs = [
            (business, pool.submit(totals, business, SALES), pool.submit(totals, business, PURCHASES))
            for business in loaded
        ]
        rows = []
        for business, sales, purchases in jobs:
            (sales_totals, sales_error), (purchase_totals, purchase_error) = sales.result(), purchases.result()
            rows.append(
                {
                    "id": business.id,
                    "sales": sales_totals,
                    "purchases": purchase_totals,
                    "error": sales_error or purchase_error,
                }
            )
    return 200, {"businesses": rows}, {}


# CIS data ----------------------------------------------------------------------


def invoices(kind: str) -> Route:
    def route(businesses: Businesses, request: Request) -> RouteResult:
        client = businesses.get(request.business).client
        body = request.body
        _only(body, {"FromDate", "ToDate", "Page", "FIC", "All"})
        fic = _optional_string(body, "FIC")
        if fic:
            invoice = client.get_invoice(fic, kind)
            found = [invoice] if invoice else []
            return 200, found, {"X-Total-Count": str(len(found))}
        page = body.get("Page", 1)
        if page is None:
            page = 1
        if not isinstance(page, int) or isinstance(page, bool) or page < 1:
            raise ValidationError("Page must be an integer of at least 1", "Page")
        fetch_all = body.get("All", False)
        if not isinstance(fetch_all, bool):
            raise ValidationError("All must be true or false", "All")
        from_date, to_date = _optional_string(body, "FromDate"), _optional_string(body, "ToDate")
        if fetch_all:
            found = client.fetch_all_invoices(kind, from_date, to_date)
            return 200, found, {"X-Total-Count": str(len(found)), "X-Page": "1", "X-Page-Count": "1"}
        result = client.get_invoices(kind, from_date, to_date, page)
        return (
            200,
            result.invoices,
            {
                "X-Total-Count": str(result.count),
                "X-Page": str(result.page),
                "X-Page-Count": str(result.pages),
            },
        )

    return route


def taxpayers(businesses: Businesses, request: Request) -> RouteResult:
    _only(request.body, {"searchTerm"})
    term = request.body.get("searchTerm")
    if not isinstance(term, str):
        raise ValidationError("searchTerm is required", "searchTerm")
    return 200, businesses.get(request.business).client.get_taxpayers(term), {}


def operators(businesses: Businesses, request: Request) -> RouteResult:
    _only(request.body, set())
    return 200, businesses.get(request.business).client.get_operators(), {}


def business_units(businesses: Businesses, request: Request) -> RouteResult:
    _only(request.body, set())
    return 200, businesses.get(request.business).client.get_business_units(), {}


def tcrs(businesses: Businesses, request: Request) -> RouteResult:
    _only(request.body, set())
    return 200, businesses.get(request.business).client.get_tcrs(), {}


def einvoice_pdf(businesses: Businesses, request: Request) -> RouteResult:
    _only(request.body, {"EIC", "PartyType"})
    eic = _optional_string(request.body, "EIC") or ""
    party = _optional_string(request.body, "PartyType") or "BUYER"
    document = businesses.get(request.business).client.get_einvoice_pdf(eic, party)
    if document is None:
        raise ApiError(404, "CIS has no PDF for this EIC")
    return 200, {"eic": document.eic, "base64": document.base64, "details": document.details}, {}


ROUTES: dict[tuple[str, str], Route] = {
    ("GET", "/api/session"): session_get,
    ("POST", "/api/session"): session_load,
    ("POST", "/api/session/active"): session_select,
    ("POST", "/api/session/environment"): session_environment,
    ("DELETE", "/api/session"): session_delete,
    ("POST", "/api/overview"): overview,
    ("POST", f"{API_PREFIX}/cis-invoices/sales"): invoices(SALES),
    ("POST", f"{API_PREFIX}/cis-invoices/purchases"): invoices(PURCHASES),
    ("POST", f"{API_PREFIX}/get-taxpayers"): taxpayers,
    ("POST", f"{API_PREFIX}/get-operators"): operators,
    ("POST", f"{API_PREFIX}/get-business-units"): business_units,
    ("POST", f"{API_PREFIX}/get-tcrs"): tcrs,
    ("POST", f"{API_PREFIX}/einvoice-pdf"): einvoice_pdf,
}
