"""Local web app and JSON API.

The server listens on 127.0.0.1 only. The certificate is uploaded from the
browser (or passed on the command line), kept in this process's memory and
never written to disk. Closing the app forgets it.

JSON API (all bodies are JSON; dates are YYYY-MM-DD):

    GET    /api/session                                   current certificate, environment
    POST   /api/session            {certificate, password, environment}
                                   certificate = base64 of the .p12/.pfx/.pem file
    POST   /api/session/environment {environment}         "production" or "test"
    DELETE /api/session                                   forget the certificate

    POST   /api/v1/utilities/cis-invoices/sales           {FromDate, ToDate, Page, FIC, All}
    POST   /api/v1/utilities/cis-invoices/purchases       same as sales
    POST   /api/v1/utilities/get-taxpayers                {searchTerm}
    POST   /api/v1/utilities/get-operators                {}
    POST   /api/v1/utilities/get-business-units           {}
    POST   /api/v1/utilities/get-tcrs                     {}
    POST   /api/v1/utilities/einvoice-pdf                 {EIC, PartyType}

Invoice lists are returned as a JSON array; the total for the search is in
the X-Total-Count header. Errors are ``{"message", "field"?, "cisError"?, "hint"?}``.
"""

from __future__ import annotations

import base64
import binascii
import json
import logging
import threading
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Tuple
from urllib.parse import urlsplit

from . import __version__
from .certificate import Certificate
from .client import PURCHASES, SALES, CisClient
from .errors import CertificateError, CisFault, TransportError, ValidationError
from .transport import ENVIRONMENTS, Poster

log = logging.getLogger("cis_client.server")

WEB_DIR = Path(__file__).resolve().parent / "web"
STATIC_FILES = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/app.css": ("app.css", "text/css; charset=utf-8"),
    "/favicon.svg": ("favicon.svg", "image/svg+xml"),
}
CONTENT_SECURITY_POLICY = (
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; "
    "base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
)
MAX_BODY = 64 * 1024
MAX_CERTIFICATE_BODY = 2 * 1024 * 1024
API_PREFIX = "/api/v1/utilities"

Payload = Any
Headers = Dict[str, str]
RouteResult = Tuple[int, Payload, Headers]


class ApiError(Exception):
    def __init__(self, status: int, message: str, field: Optional[str] = None, extra: Optional[dict] = None):
        super().__init__(message)
        self.status = status
        self.field = field
        self.extra = extra or {}


def _only(body: dict, allowed: set) -> None:
    unknown = sorted(set(body) - allowed)
    if unknown:
        raise ValidationError(f"Unknown fields found, please remove them: {', '.join(unknown)}", unknown[0])


def _optional_string(body: dict, key: str) -> Optional[str]:
    value = body.get(key)
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise ValidationError(f"{key} must be a string", key)
    return value.strip()


class App:
    """State shared by all requests: the loaded certificate and its CIS client."""

    def __init__(self, timeout: float = 60.0, verify_tls: bool = True, poster: Optional[Poster] = None):
        self.timeout = timeout
        self.verify_tls = verify_tls
        self.poster = poster  # replaces the HTTP layer in tests
        self._lock = threading.Lock()
        self.client: Optional[CisClient] = None
        self.nipt: Optional[str] = None
        self.verified = False
        self.warning: Optional[str] = None

    # Session ------------------------------------------------------------------

    def load(self, certificate: Certificate, environment: Optional[str]) -> dict:
        """Check the certificate with CIS and keep it for later requests.

        Without an explicit environment the one the certificate was issued for
        is tried first, then the other one if CIS refuses the certificate there.
        """
        if environment is not None and environment not in ENVIRONMENTS:
            raise ValidationError("environment must be production or test", "environment")
        suggested = certificate.suggested_environment
        candidates = [environment] if environment else [suggested, "test" if suggested == "production" else "production"]
        nipt, verified, warning = certificate.nipt, False, None
        refused: Optional[CisFault] = None
        for candidate in candidates:
            client = CisClient(certificate, candidate, timeout=self.timeout, verify_tls=self.verify_tls, poster=self.poster)
            try:
                # A cheap signed call proves CIS accepts this certificate in this environment.
                tcrs = client.get_tcrs()
            except CisFault as fault:
                if not fault.is_client_error:
                    warning = f"CIS could not confirm the certificate right now: {fault}"
                    break
                refused = refused or fault
                if fault.fault_code in ("34", "35"):  # issued for the other environment
                    continue
                raise  # CIS refuses this certificate; do not keep it.
            except TransportError as error:
                warning = f"CIS could not be reached to confirm the certificate: {error}"
                break
            verified, refused = True, None
            nipt = nipt or next((item.get("IssuerNUIS") for item in tcrs if item.get("IssuerNUIS")), None)
            break
        if refused is not None:
            raise refused
        with self._lock:
            self.client, self.nipt, self.verified, self.warning = client, nipt, verified, warning
        return self.session()

    def unload(self) -> None:
        with self._lock:
            self.client, self.nipt, self.verified, self.warning = None, None, False, None

    def session(self) -> dict:
        client = self.client
        if client is None:
            return {"loaded": False, "version": __version__}
        summary = client.certificate.summary()
        summary["nipt"] = summary["nipt"] or self.nipt
        return {
            "loaded": True,
            "version": __version__,
            "environment": client.environment,
            "verified": self.verified,
            "warning": self.warning,
            "certificate": summary,
        }

    def require_client(self) -> CisClient:
        client = self.client
        if client is None:
            raise ApiError(401, "Load a certificate first")
        return client


# Routes ----------------------------------------------------------------------


def session_get(app: App, body: dict) -> RouteResult:
    return 200, app.session(), {}


def session_load(app: App, body: dict) -> RouteResult:
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
    environment = _optional_string(body, "environment")
    certificate = Certificate.from_bytes(data, password)
    return 200, app.load(certificate, environment), {}


def session_environment(app: App, body: dict) -> RouteResult:
    _only(body, {"environment"})
    environment = _optional_string(body, "environment")
    if environment not in ENVIRONMENTS:
        raise ValidationError("environment must be production or test", "environment")
    return 200, app.load(app.require_client().certificate, environment), {}


def session_delete(app: App, body: dict) -> RouteResult:
    app.unload()
    return 200, app.session(), {}


def invoices(kind: str) -> Callable[[App, dict], RouteResult]:
    def route(app: App, body: dict) -> RouteResult:
        client = app.require_client()
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
        return 200, result.invoices, {
            "X-Total-Count": str(result.count),
            "X-Page": str(result.page),
            "X-Page-Count": str(result.pages),
        }

    return route


def taxpayers(app: App, body: dict) -> RouteResult:
    client = app.require_client()
    _only(body, {"searchTerm"})
    term = body.get("searchTerm")
    if not isinstance(term, str):
        raise ValidationError("searchTerm is required", "searchTerm")
    return 200, client.get_taxpayers(term), {}


def operators(app: App, body: dict) -> RouteResult:
    _only(body, set())
    return 200, app.require_client().get_operators(), {}


def business_units(app: App, body: dict) -> RouteResult:
    _only(body, set())
    return 200, app.require_client().get_business_units(), {}


def tcrs(app: App, body: dict) -> RouteResult:
    _only(body, set())
    return 200, app.require_client().get_tcrs(), {}


def einvoice_pdf(app: App, body: dict) -> RouteResult:
    client = app.require_client()
    _only(body, {"EIC", "PartyType"})
    eic = _optional_string(body, "EIC") or ""
    party = _optional_string(body, "PartyType") or "BUYER"
    document = client.get_einvoice_pdf(eic, party)
    if document is None:
        raise ApiError(404, "CIS has no PDF for this EIC")
    return 200, {"eic": document.eic, "base64": document.base64, "details": document.details}, {}


ROUTES: Dict[Tuple[str, str], Callable[[App, dict], RouteResult]] = {
    ("GET", "/api/session"): session_get,
    ("POST", "/api/session"): session_load,
    ("POST", "/api/session/environment"): session_environment,
    ("DELETE", "/api/session"): session_delete,
    ("POST", f"{API_PREFIX}/cis-invoices/sales"): invoices(SALES),
    ("POST", f"{API_PREFIX}/cis-invoices/purchases"): invoices(PURCHASES),
    ("POST", f"{API_PREFIX}/get-taxpayers"): taxpayers,
    ("POST", f"{API_PREFIX}/get-operators"): operators,
    ("POST", f"{API_PREFIX}/get-business-units"): business_units,
    ("POST", f"{API_PREFIX}/get-tcrs"): tcrs,
    ("POST", f"{API_PREFIX}/einvoice-pdf"): einvoice_pdf,
}


# HTTP ------------------------------------------------------------------------


class Handler(BaseHTTPRequestHandler):
    server_version = "cis-client"
    sys_version = ""
    protocol_version = "HTTP/1.1"

    @property
    def app(self) -> App:
        return self.server.app  # type: ignore[attr-defined]

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002 - signature defined by the base class
        log.debug("%s - %s", self.address_string(), format % args)

    def _common_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Cache-Control", "no-store")

    def _send(self, status: int, data: bytes, content_type: str, headers: Optional[Headers] = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self._common_headers()
        if content_type.startswith("text/html"):
            self.send_header("Content-Security-Policy", CONTENT_SECURITY_POLICY)
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def _send_json(self, status: int, payload: Payload, headers: Optional[Headers] = None) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._send(status, data, "application/json; charset=utf-8", headers)

    def _trusted(self) -> bool:
        """Only accept requests addressed to this server from its own pages.

        Checking Host defeats DNS rebinding; checking Origin and Sec-Fetch-Site
        stops other websites open in the browser from driving the API.
        """
        port = self.server.server_address[1]
        hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
        if self.headers.get("Host", "") not in hosts:
            return False
        origin = self.headers.get("Origin")
        if origin and origin not in {f"http://{host}" for host in hosts}:
            return False
        return self.headers.get("Sec-Fetch-Site", "same-origin") in ("same-origin", "none")

    def _read_json(self, limit: int) -> dict:
        if self.headers.get("Transfer-Encoding"):
            raise ApiError(411, "Send a Content-Length header")
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            raise ApiError(400, "Invalid Content-Length") from None
        if length > limit:
            raise ApiError(413, "Request body is too large")
        raw = self.rfile.read(length) if length else b""
        if not raw.strip():
            return {}
        try:
            body = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ApiError(400, "Request body must be valid JSON") from None
        if not isinstance(body, dict):
            raise ApiError(400, "Request body must be a JSON object")
        return body

    def do_GET(self) -> None:  # noqa: N802 - name defined by the base class
        path = urlsplit(self.path).path
        if not self._trusted():
            self._send_json(403, {"message": "Forbidden"})
            return
        if path in STATIC_FILES:
            name, content_type = STATIC_FILES[path]
            try:
                self._send(200, (WEB_DIR / name).read_bytes(), content_type)
            except OSError:
                self._send_json(404, {"message": "Not found"})
            return
        self._api("GET", path)

    def do_HEAD(self) -> None:  # noqa: N802
        self.do_GET()

    def do_POST(self) -> None:  # noqa: N802
        self._api("POST", urlsplit(self.path).path)

    def do_DELETE(self) -> None:  # noqa: N802
        self._api("DELETE", urlsplit(self.path).path)

    def _api(self, method: str, path: str) -> None:
        try:
            if not self._trusted():
                raise ApiError(403, "Forbidden")
            route = ROUTES.get((method, path))
            if route is None:
                raise ApiError(404, "Not found")
            body: dict = {}
            if method == "POST":
                content_type = self.headers.get("Content-Type", "").split(";")[0].strip().lower()
                if content_type != "application/json":
                    raise ApiError(415, "Content-Type must be application/json")
                body = self._read_json(MAX_CERTIFICATE_BODY if path == "/api/session" else MAX_BODY)
            status, payload, headers = route(self.app, body)
            self._send_json(status, payload, headers)
        except ApiError as error:
            payload = {"message": str(error), **error.extra}
            if error.field:
                payload["field"] = error.field
            self._send_json(error.status, payload)
        except ValidationError as error:
            payload = {"message": str(error)}
            if error.field:
                payload["field"] = error.field
            self._send_json(400, payload)
        except CertificateError as error:
            self._send_json(400, {"message": str(error), "field": "certificate"})
        except CisFault as fault:
            payload = {"message": str(fault), "cisError": fault.to_dict()}
            if fault.hint:
                payload["hint"] = fault.hint
            self._send_json(422 if fault.is_client_error else 502, payload)
        except TransportError as error:
            self._send_json(502, {"message": str(error)})
        except Exception as error:  # Keep the server alive and tell the page what went wrong.
            log.error("Unexpected error on %s %s\n%s", method, path, traceback.format_exc())
            self._send_json(500, {"message": f"Unexpected error: {error}"})


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, port: int, app: App):
        super().__init__(("127.0.0.1", port), Handler)
        self.app = app


def create_server(port: int, app: App, attempts: int = 20) -> Server:
    """Bind to ``port``, or to the next free port when it is taken."""
    last_error: Optional[OSError] = None
    for candidate in range(port, port + attempts):
        try:
            return Server(candidate, app)
        except OSError as error:
            last_error = error
    raise OSError(f"No free port between {port} and {port + attempts - 1}: {last_error}")


def serve(app: App, port: int = 8765, open_browser: bool = True) -> None:
    server = create_server(port, app)
    url = f"http://127.0.0.1:{server.server_address[1]}/"
    print(f"CIS Client is running at {url}")
    print("Keep this window open while you use the app. Press Ctrl+C to stop.")
    if open_browser:
        threading.Timer(0.6, webbrowser.open, [url]).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()
