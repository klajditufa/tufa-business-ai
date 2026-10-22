"""High level CIS client: sales, purchases, taxpayers, operators and more.

Example::

    from cis_client import CisClient

    client = CisClient.from_file("company.p12", password="secret")  # environment taken from the certificate
    page = client.get_sales("2026-09-01", "2026-09-30")
    print(page.count, page.invoices[0]["TotPrice"])
"""

from __future__ import annotations

import base64
import math
import re
from collections.abc import Iterator, Sequence
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Callable, Optional, Union

from lxml import etree

from . import convert, timeutil
from .certificate import Certificate, Password
from .errors import CisFault, ValidationError
from .transport import (
    GET_BUSINESS_UNITS,
    GET_EINVOICES,
    GET_INVOICES,
    GET_OPERATORS,
    GET_TAXPAYERS,
    GET_TCRS,
    Poster,
    SoapTransport,
    child,
    local_name,
)

PAGE_SIZE = 1000  # CIS returns at most 1000 invoices per page.
DETAIL_WORKERS = 4  # FIC lookups run in parallel when items are needed for a whole list.
SALES = "SALES"
PURCHASES = "PURCHASES"
INVOICE_KINDS = (SALES, PURCHASES)
PARTY_TYPES = ("BUYER", "SELLER")

# UUID format accepted by CIS (version 1-5, RFC 4122 variant).
UUID_PATTERN = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
NIPT_PATTERN = re.compile(r"^[A-Za-z]\d{8}[A-Za-z]$")

DateArg = Optional[Union[date, str]]
# progress(invoices fetched so far, total reported by CIS for the current range, range start, range end)
Progress = Callable[[int, int, date, date], None]
# detail_progress(invoices looked up so far, invoices to look up)
DetailProgress = Callable[[int, int], None]


@dataclass
class InvoicePage:
    invoices: list[dict]
    count: int  # total number of invoices matching the search, across all pages
    page: int
    page_size: int = PAGE_SIZE

    @property
    def pages(self) -> int:
        return max(1, math.ceil(self.count / self.page_size))

    @property
    def has_more(self) -> bool:
        return self.page < self.pages


@dataclass
class EinvoicePdf:
    eic: str
    pdf: bytes
    details: dict = field(default_factory=dict)  # DocNumber, Status, Amount, BuyerTin, SellerTin, ...

    @property
    def base64(self) -> str:
        return base64.b64encode(self.pdf).decode("ascii")


def _date_range(from_date: DateArg, to_date: DateArg) -> tuple[date, date]:
    default_from, default_to = timeutil.current_month()
    try:
        start = timeutil.parse_date(from_date, "FromDate") if from_date else default_from
    except ValueError as error:
        raise ValidationError(str(error), "FromDate") from None
    try:
        end = timeutil.parse_date(to_date, "ToDate") if to_date else default_to
    except ValueError as error:
        raise ValidationError(str(error), "ToDate") from None
    if end < start:
        raise ValidationError("ToDate must not be before FromDate", "ToDate")
    return start, end


def _kind(kind: str) -> str:
    value = (kind or "").upper()
    if value not in INVOICE_KINDS:
        raise ValidationError("kind must be SALES or PURCHASES", "kind")
    return value


def _uuid(value: str, field_name: str) -> str:
    value = (value or "").strip()
    if not UUID_PATTERN.match(value):
        raise ValidationError(f"{field_name} must be a UUID like 2ed48eff-f3d0-4315-a2a5-16618c63ad0b", field_name)
    return value.lower()


class CisClient:
    """Reads data from CIS on behalf of the business that owns ``certificate``.

    ``environment`` is "production" or "test"; by default it is the one the
    certificate was issued for (see Certificate.suggested_environment).
    """

    def __init__(
        self,
        certificate: Certificate,
        environment: str | None = None,
        *,
        timeout: float = 60.0,
        retries: int = 2,
        verify_tls: bool = True,
        poster: Poster | None = None,
    ):
        self.certificate = certificate
        self.transport = SoapTransport(
            certificate,
            environment or certificate.suggested_environment,
            timeout=timeout,
            retries=retries,
            verify_tls=verify_tls,
            poster=poster,
        )

    @classmethod
    def from_file(
        cls, path: str | Path, password: Password = None, environment: str | None = None, **options
    ) -> CisClient:
        return cls(Certificate.from_file(path, password), environment, **options)

    @property
    def environment(self) -> str:
        return self.transport.environment

    # Sales and purchases ------------------------------------------------------

    def get_invoices(self, kind: str, from_date: DateArg = None, to_date: DateArg = None, page: int = 1) -> InvoicePage:
        """One page (up to 1000) of invoices issued between two dates, inclusive.

        Without dates the current month is used. ``kind`` is SALES (invoices
        this business issued) or PURCHASES (invoices issued to this business).
        """
        kind = _kind(kind)
        start, end = _date_range(from_date, to_date)
        if not isinstance(page, int) or isinstance(page, bool) or page < 1:
            raise ValidationError("Page must be an integer of at least 1", "Page")

        def body(request: etree._Element, namespace: str) -> None:
            etree.SubElement(
                request,
                f"{{{namespace}}}InvoicesRequestBody",
                {
                    "FromDate": timeutil.start_of_day(start),
                    "ToDate": timeutil.end_of_day(end),
                    "InvTransactionType": kind,
                    "Page": str(page),
                },
            )

        invoices, count = convert.invoices_from_response(self.transport.call(GET_INVOICES, body))
        return InvoicePage(invoices, count, page)

    def get_sales(self, from_date: DateArg = None, to_date: DateArg = None, page: int = 1) -> InvoicePage:
        return self.get_invoices(SALES, from_date, to_date, page)

    def get_purchases(self, from_date: DateArg = None, to_date: DateArg = None, page: int = 1) -> InvoicePage:
        return self.get_invoices(PURCHASES, from_date, to_date, page)

    def get_invoice(self, fic: str, kind: str) -> dict | None:
        """The complete invoice, including its items, or None when CIS has no such invoice."""
        kind = _kind(kind)
        fic = _uuid(fic, "FIC")

        def body(request: etree._Element, namespace: str) -> None:
            etree.SubElement(request, f"{{{namespace}}}InvoicesRequestBody", {"FIC": fic, "InvTransactionType": kind})

        invoices, _ = convert.invoices_from_response(self.transport.call(GET_INVOICES, body))
        return invoices[0] if invoices else None

    def get_invoice_details(
        self,
        invoices: Sequence[dict],
        kind: str,
        progress: DetailProgress | None = None,
        workers: int = DETAIL_WORKERS,
    ) -> list[dict]:
        """The complete invoices, with items, for invoices taken from a date range list.

        Lists come without items, so every invoice is looked up by its FIC: one
        CIS call each, ``workers`` at a time. The result keeps the order of
        ``invoices``; invoices that already have items, have no FIC or that CIS
        does not find are returned unchanged.
        """
        kind = _kind(kind)
        result = list(invoices)
        pending = [index for index, invoice in enumerate(result) if invoice.get("FIC") and "Items" not in invoice]
        if not pending:
            return result
        with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
            futures = {pool.submit(self.get_invoice, result[index]["FIC"], kind): index for index in pending}
            try:
                for done, future in enumerate(as_completed(futures), 1):
                    complete = future.result()
                    if complete is not None:
                        result[futures[future]] = complete
                    if progress:
                        progress(done, len(pending))
            except BaseException:
                for future in futures:
                    future.cancel()  # Stop the lookups that have not started; running ones finish.
                raise
        return result

    def iter_invoices(
        self, kind: str, from_date: DateArg = None, to_date: DateArg = None, progress: Progress | None = None
    ) -> Iterator[dict]:
        """Every invoice in the range, fetching all pages.

        CIS refuses long searches with fault 87; the range is then split in
        half and each half is fetched separately, down to single days.
        """
        kind = _kind(kind)
        start, end = _date_range(from_date, to_date)
        seen: set[str] = set()
        fetched = 0
        pending = [(start, end)]
        while pending:
            range_start, range_end = pending.pop(0)
            try:
                first = self.get_invoices(kind, range_start, range_end, 1)
            except CisFault as fault:
                if fault.fault_code == "87" and range_start < range_end:
                    pending[0:0] = list(timeutil.split_range(range_start, range_end))
                    continue
                raise
            page = first
            while True:
                for invoice in page.invoices:
                    key = invoice.get("FIC") or invoice.get("IIC")
                    if key:
                        if key in seen:
                            continue  # Guards against overlap if new invoices shift the pages.
                        seen.add(key)
                    fetched += 1
                    yield invoice
                if progress:
                    progress(fetched, first.count, range_start, range_end)
                if not page.has_more or not page.invoices:
                    break
                page = self.get_invoices(kind, range_start, range_end, page.page + 1)

    def fetch_all_invoices(
        self, kind: str, from_date: DateArg = None, to_date: DateArg = None, progress: Progress | None = None
    ) -> list[dict]:
        return list(self.iter_invoices(kind, from_date, to_date, progress))

    # Registry lookups ---------------------------------------------------------

    def get_taxpayers(self, search_term: str) -> list[dict]:
        """Search the taxpayer registry by NIPT (exact) or by name (3 to 100 characters)."""
        term = (search_term or "").strip()
        if NIPT_PATTERN.match(term):
            tag, value = "Tin", term.upper()
        elif 3 <= len(term) <= 100:
            tag, value = "Name", term
        else:
            raise ValidationError("searchTerm must be a NIPT or a name of 3 to 100 characters", "searchTerm")

        def body(request: etree._Element, namespace: str) -> None:
            search = etree.SubElement(request, f"{{{namespace}}}Filter")
            etree.SubElement(search, f"{{{namespace}}}{tag}").text = value

        return convert.taxpayers_from_response(self.transport.call(GET_TAXPAYERS, body))

    def get_operators(self) -> list[dict]:
        """Operators (cashiers) registered for this business; ``opCode`` is their OperatorCode."""
        return convert.operators_from_response(self.transport.call(GET_OPERATORS))

    def get_business_units(self) -> list[dict]:
        """Business units (premises) registered for this business; ``BUCode`` is their BusinUnitCode."""
        return convert.list_from_response(self.transport.call(GET_BUSINESS_UNITS), "BusinessUnits", "BusinessUnit")

    def get_tcrs(self) -> list[dict]:
        """Registered cash registers / devices (TCRs) with their TCRCode."""
        return convert.list_from_response(self.transport.call(GET_TCRS), "TCRs", "TCR")

    # Electronic invoices ------------------------------------------------------

    def get_einvoice_pdf(self, eic: str, party_type: str = "BUYER") -> EinvoicePdf | None:
        """The official PDF of an electronic invoice, found by its EIC.

        ``party_type`` is BUYER for purchases and SELLER for sales.
        """
        eic = _uuid(eic, "EIC")
        party_type = (party_type or "").upper()
        if party_type not in PARTY_TYPES:
            raise ValidationError("PartyType must be BUYER or SELLER", "PartyType")

        def body(request: etree._Element, namespace: str) -> None:
            etree.SubElement(request, f"{{{namespace}}}EIC").text = eic
            etree.SubElement(request, f"{{{namespace}}}PartyType").text = party_type

        container = child(self.transport.call(GET_EINVOICES, body), "Einvoices")
        if container is None:
            return None
        for node in container:
            if local_name(node) != "Einvoice" or (node.get("EIC") or "").lower() != eic:
                continue
            pdf_node = child(node, "Pdf")
            text = "".join((pdf_node.text or "").split()) if pdf_node is not None else ""
            if not text:
                return None
            try:
                pdf = base64.b64decode(text, validate=True)
            except ValueError:
                return None
            return EinvoicePdf(eic, pdf, dict(node.attrib))
        return None
