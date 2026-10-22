"""HTTP layer: serves the built web interface and the JSON API on 127.0.0.1."""

from __future__ import annotations

import json
import logging
import re
import threading
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from ..errors import CertificateError, CisFault, TransportError, ValidationError
from .businesses import Businesses
from .errors import ApiError
from .routes import ROUTES, Headers, Payload, Request

log = logging.getLogger("cis_client.server")

# The web interface, built from frontend/ by `npm run build`.
WEB_DIR = Path(__file__).resolve().parent.parent / "web"
STATIC_PATH = re.compile(r"^/(?:assets/)?[A-Za-z0-9_-][A-Za-z0-9._-]*$")
CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".webmanifest": "application/manifest+json",
    ".woff2": "font/woff2",
}
NOT_BUILT = (
    b"<!doctype html><meta charset=utf-8><title>CIS Client</title>"
    b"<p>The web interface has not been built. "
    b"Run <code>npm install && npm run build</code> in <code>frontend/</code>.</p>"
)
# Scripts only from this server. Inline styles are allowed because the UI library (Mantine) sets
# its theme variables in a <style> element; styles cannot run code.
CONTENT_SECURITY_POLICY = (
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
    "font-src 'self' data:; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; "
    "frame-ancestors 'none'"
)
MAX_BODY = 64 * 1024
MAX_CERTIFICATE_BODY = 2 * 1024 * 1024


def static_file(path: str) -> tuple[Path, str] | None:
    """The file under WEB_DIR that ``path`` names, with its content type; None for anything else."""
    if path in ("/", "/index.html"):
        path = "/index.html"
    elif not STATIC_PATH.match(path):
        return None
    file = (WEB_DIR / path.lstrip("/")).resolve()
    content_type = CONTENT_TYPES.get(file.suffix)
    if content_type is None or WEB_DIR not in file.parents or not file.is_file():
        return None
    return file, content_type


def error_response(error: Exception) -> tuple[int, dict]:
    """Status and JSON body for an error raised while answering an API request."""
    if isinstance(error, ApiError):
        payload = {"message": str(error), **error.extra}
        if error.field:
            payload["field"] = error.field
        return error.status, payload
    if isinstance(error, ValidationError):
        payload = {"message": str(error)}
        if error.field:
            payload["field"] = error.field
        return 400, payload
    if isinstance(error, CertificateError):
        return 400, {"message": str(error), "field": "certificate"}
    if isinstance(error, CisFault):
        payload = {"message": str(error), "cisError": error.to_dict()}
        if error.hint:
            payload["hint"] = error.hint
        return (422 if error.is_client_error else 502), payload
    if isinstance(error, TransportError):
        return 502, {
            "message": str(error),
            "unreachable": True,
            "hint": "The tax authority's service did not answer. It is probably down for a while; try again later.",
        }
    return 500, {"message": f"Unexpected error: {error}"}


class Handler(BaseHTTPRequestHandler):
    server_version = "cis-client"
    sys_version = ""
    protocol_version = "HTTP/1.1"

    @property
    def businesses(self) -> Businesses:
        return self.server.businesses  # type: ignore[attr-defined]

    def log_message(self, format: str, *args: Any) -> None:
        log.debug("%s - %s", self.address_string(), format % args)

    def _send(self, status: int, data: bytes, content_type: str, headers: Headers | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Cache-Control", "no-store")
        if content_type.startswith("text/html"):
            self.send_header("Content-Security-Policy", CONTENT_SECURITY_POLICY)
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def _send_json(self, status: int, payload: Payload, headers: Headers | None = None) -> None:
        self._send(
            status, json.dumps(payload, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8", headers
        )

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

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path.startswith("/api/"):
            self._api("GET", path)
            return
        if not self._trusted():
            self._send_json(403, {"message": "Forbidden"})
            return
        found = static_file(path)
        if found:
            self._send(200, found[0].read_bytes(), found[1])
        elif path in ("/", "/index.html"):
            self._send(200, NOT_BUILT, "text/html; charset=utf-8")
        else:
            self._send_json(404, {"message": "Not found"})

    def do_HEAD(self) -> None:
        self.do_GET()

    def do_POST(self) -> None:
        self._api("POST", urlsplit(self.path).path)

    def do_DELETE(self) -> None:
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
            status, payload, headers = route(self.businesses, Request(body, self.headers.get("X-Business") or None))
            self._send_json(status, payload, headers)
        except Exception as error:  # Answer every failure as JSON and keep the server running.
            status, payload = error_response(error)
            if status == 500:
                log.error("Unexpected error on %s %s\n%s", method, path, traceback.format_exc())
            self._send_json(status, payload)


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, port: int, businesses: Businesses):
        super().__init__(("127.0.0.1", port), Handler)
        self.businesses = businesses


def create_server(port: int, businesses: Businesses, attempts: int = 20) -> Server:
    """Bind to ``port``, or to the next free port when it is taken."""
    last_error: OSError | None = None
    for candidate in range(port, port + attempts):
        try:
            return Server(candidate, businesses)
        except OSError as error:
            last_error = error
    raise OSError(f"No free port between {port} and {port + attempts - 1}: {last_error}")


def serve(businesses: Businesses, port: int = 8765, open_browser: bool = True) -> None:
    server = create_server(port, businesses)
    url = f"http://127.0.0.1:{server.server_address[1]}/"
    print(f"CIS Client is running at {url}", flush=True)
    print("Keep this window open while you use the app. Press Ctrl+C to stop.", flush=True)
    if open_browser:
        threading.Timer(0.6, webbrowser.open, [url]).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()
