from __future__ import annotations

import base64
import hashlib
import http.client
import json
import threading
import unittest

from cryptography import x509
from cryptography.hazmat.primitives.serialization import BestAvailableEncryption, pkcs12
from cryptography.x509.oid import NameOID

from cis_client.server import Businesses, create_server
from cis_client.server.http import WEB_DIR

from .fake_cis import FakeCis
from .helpers import TEST_P12, TEST_P12_PASSWORD, make_x509, test_key


class ServerTest(unittest.TestCase):
    def setUp(self) -> None:
        self.fake = FakeCis(invoices_per_day=2)
        self.server = create_server(0, Businesses(poster=self.fake))
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()

    def request(
        self, method: str, path: str, body: dict | None = None, headers: dict[str, str] | None = None
    ) -> tuple[int, dict[str, str], object]:
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        all_headers = {"Host": f"127.0.0.1:{self.port}"}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            all_headers["Content-Type"] = "application/json"
        all_headers.update(headers or {})
        connection.request(method, path, body=data, headers=all_headers)
        response = connection.getresponse()
        raw = response.read()
        connection.close()
        content_type = response.getheader("Content-Type", "")
        payload = json.loads(raw) if content_type.startswith("application/json") else raw
        return response.status, dict(response.getheaders()), payload

    def load(
        self, environment: str | None = "test", p12: bytes | None = None, password: str = TEST_P12_PASSWORD
    ) -> dict:
        """Loads a certificate and returns the active business from the session."""
        status, _, session = self.request(
            "POST",
            "/api/session",
            {
                "certificate": base64.b64encode(p12 or TEST_P12.read_bytes()).decode(),
                "password": password,
                "environment": environment,
            },
        )
        self.assertEqual(status, 200, session)
        return active(session)

    def test_static_page(self) -> None:
        status, headers, body = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn(b'<div id="root">', body)
        self.assertIn("script-src 'self'", headers["Content-Security-Policy"])
        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
        script = next(path for path in (WEB_DIR / "assets").iterdir() if path.suffix == ".js")
        status, headers, _ = self.request("GET", f"/assets/{script.name}")
        self.assertEqual((status, headers["Content-Type"]), (200, "text/javascript; charset=utf-8"))
        self.assertEqual(self.request("GET", "/favicon.svg")[0], 200)
        for path in ("/../server.py", "/assets/../../units.json", "/assets/%2e%2e/x.js", "/.hidden.js", "/missing.js"):
            self.assertEqual(self.request("GET", path)[0], 404, path)

    def test_session_lifecycle(self) -> None:
        self.assertEqual(self.request("GET", "/api/session")[2]["businesses"], [])
        business = self.load(environment=None)  # environment guessed from the issuer
        self.assertTrue(business["verified"])
        self.assertEqual(business["environment"], "test")
        self.assertEqual(business["certificate"]["nipt"], "X99999999X")
        self.assertEqual(self.fake.requests[-1][0], "GetTCRs")  # the certificate was checked with CIS
        status, _, switched = self.request("POST", "/api/session/environment", {"environment": "production"})
        self.assertEqual((status, active(switched)["environment"]), (200, "production"))
        self.assertEqual(len(switched["businesses"]), 1)  # same certificate, replaced
        status, _, cleared = self.request("DELETE", "/api/session")
        self.assertEqual((status, cleared["businesses"], cleared["active"]), (200, [], None))

    def test_several_businesses(self) -> None:
        first = self.load()
        second = self.load(p12=second_p12(), password="second")
        status, _, session = self.request("GET", "/api/session")
        self.assertEqual([business["id"] for business in session["businesses"]], [first["id"], second["id"]])
        self.assertEqual(session["active"], second["id"])
        self.assertEqual(second["certificate"]["nipt"], "Y88888888Y")
        # Requests name their business; without a name the active one is used.
        self.request("POST", "/api/v1/utilities/get-operators", {}, {"X-Business": first["id"]})
        self.assertEqual(signer(self.fake), first["id"])
        self.request("POST", "/api/v1/utilities/get-operators", {})
        self.assertEqual(signer(self.fake), second["id"])
        status, _, session = self.request("POST", "/api/session/active", {"id": first["id"]})
        self.assertEqual((status, session["active"]), (200, first["id"]))
        self.assertEqual(self.request("POST", "/api/v1/utilities/get-tcrs", {}, {"X-Business": "unknown"})[0], 401)
        status, _, overview = self.request("POST", "/api/overview", {"FromDate": "2026-09-01", "ToDate": "2026-09-30"})
        self.assertEqual(status, 200)
        rows = {row["id"]: row for row in overview["businesses"]}
        self.assertEqual(rows[first["id"]]["sales"]["count"], "60")
        self.assertEqual(rows[second["id"]]["purchases"]["count"], "60")
        self.assertIsNone(rows[first["id"]]["error"])
        status, _, session = self.request("DELETE", "/api/session", None, {"X-Business": first["id"]})
        self.assertEqual([business["id"] for business in session["businesses"]], [second["id"]])
        self.assertEqual(session["active"], second["id"])

    def test_automatic_environment_falls_back(self) -> None:
        # The fixture looks like a test certificate; pretend CIS only accepts it in production.
        self.fake.issued_for = "production"
        business = self.load(environment=None)
        self.assertEqual((business["environment"], business["verified"]), ("production", True))
        self.assertEqual(
            [operation for operation, _ in self.fake.requests], ["GetTCRs", "GetTCRs"]
        )  # test, then production
        status, _, error = self.request("POST", "/api/session/environment", {"environment": "test"})
        self.assertEqual((status, error["cisError"]["faultCode"]), (422, "34"))

    def test_wrong_password(self) -> None:
        status, _, error = self.request(
            "POST",
            "/api/session",
            {"certificate": base64.b64encode(TEST_P12.read_bytes()).decode(), "password": "nope"},
        )
        self.assertEqual(status, 400)
        self.assertEqual(error["field"], "certificate")

    def test_certificate_refused_by_cis(self) -> None:
        self.fake.fault = ("env:CLIENT", "Certificate is not issued by NAIS.", "35")
        status, _, error = self.request(
            "POST",
            "/api/session",
            {"certificate": base64.b64encode(TEST_P12.read_bytes()).decode(), "password": TEST_P12_PASSWORD},
        )
        self.assertEqual(status, 422)
        self.assertEqual(error["cisError"]["faultCode"], "35")
        self.assertIn("environment", error["hint"])
        self.assertEqual(self.request("GET", "/api/session")[2]["businesses"], [])

    def test_requires_certificate(self) -> None:
        status, _, error = self.request("POST", "/api/v1/utilities/get-operators", {})
        self.assertEqual(status, 401)
        self.assertIn("certificate", error["message"])

    def test_invoices(self) -> None:
        self.load()
        status, headers, invoices = self.request(
            "POST",
            "/api/v1/utilities/cis-invoices/sales",
            {"FromDate": "2026-09-01", "ToDate": "2026-09-30", "Page": 1},
        )
        self.assertEqual(status, 200)
        self.assertEqual(headers["X-Total-Count"], "60")
        self.assertEqual(len(invoices), 60)
        status, headers, everything = self.request(
            "POST",
            "/api/v1/utilities/cis-invoices/purchases",
            {"FromDate": "2026-01-01", "ToDate": "2026-03-31", "All": True},
        )
        self.assertEqual((status, headers["X-Total-Count"], len(everything)), (200, "180", 180))
        status, _, found = self.request(
            "POST", "/api/v1/utilities/cis-invoices/purchases", {"FIC": everything[0]["FIC"]}
        )
        self.assertEqual(status, 200)
        self.assertTrue(found[0]["Items"])

    def test_validation_errors(self) -> None:
        self.load()
        path = "/api/v1/utilities/cis-invoices/sales"
        status, _, error = self.request("POST", path, {"FromDate": "2026-09-01", "Extra": 1})
        self.assertEqual((status, error["field"]), (400, "Extra"))
        status, _, error = self.request("POST", path, {"FromDate": "2026-09-30", "ToDate": "2026-09-01"})
        self.assertEqual((status, error["field"]), (400, "ToDate"))
        status, _, error = self.request("POST", path, {"Page": "2"})
        self.assertEqual((status, error["field"]), (400, "Page"))
        status, _, error = self.request("POST", "/api/v1/utilities/get-taxpayers", {"searchTerm": "ab"})
        self.assertEqual((status, error["field"]), (400, "searchTerm"))

    def test_cis_fault(self) -> None:
        self.load()
        status, _, error = self.request(
            "POST", "/api/v1/utilities/cis-invoices/sales", {"FromDate": "2025-01-01", "ToDate": "2026-12-31"}
        )
        self.assertEqual(status, 422)
        self.assertEqual(
            error["cisError"],
            {"faultEnv": "env:CLIENT", "faultString": "Search period limit exceeded.", "faultCode": "87"},
        )
        self.assertIn("hint", error)

    def test_registry_endpoints(self) -> None:
        self.load()
        self.assertEqual(
            self.request("POST", "/api/v1/utilities/get-taxpayers", {"searchTerm": "alfa"})[2][0]["Tin"], "K11111111A"
        )
        self.assertEqual(self.request("POST", "/api/v1/utilities/get-operators", {})[2][0]["opCode"], "op123op123")
        self.assertEqual(self.request("POST", "/api/v1/utilities/get-business-units", {})[2][0]["BUCode"], "bu123bu123")
        self.assertEqual(self.request("POST", "/api/v1/utilities/get-tcrs", {})[2][0]["TCRCode"], "ab123cd456")
        status, _, pdf = self.request(
            "POST",
            "/api/v1/utilities/einvoice-pdf",
            {"EIC": "2ed48eff-f3d0-4315-a2a5-16618c63ad0b", "PartyType": "BUYER"},
        )
        self.assertEqual(status, 200)
        self.assertTrue(base64.b64decode(pdf["base64"]).startswith(b"%PDF-"))

    def test_rejects_foreign_pages(self) -> None:
        self.load()
        path = "/api/v1/utilities/get-operators"
        self.assertEqual(self.request("POST", path, {}, {"Origin": "https://example.com"})[0], 403)
        self.assertEqual(self.request("POST", path, {}, {"Host": "attacker.example:80"})[0], 403)
        self.assertEqual(self.request("POST", path, {}, {"Sec-Fetch-Site": "cross-site"})[0], 403)
        self.assertEqual(self.request("GET", "/", None, {"Host": "rebound.example"})[0], 403)
        self.assertEqual(self.request("POST", path, {}, {"Content-Type": "text/plain"})[0], 415)
        self.assertEqual(self.request("POST", path, {}, {"Origin": f"http://localhost:{self.port}"})[0], 200)


def active(session: dict) -> dict:
    return next(business for business in session["businesses"] if business["id"] == session["active"])


def second_p12() -> bytes:
    """Another business's test certificate (NIPT Y88888888Y), protected with the password "second"."""
    certificate = make_x509(
        [
            x509.NameAttribute(NameOID.COMMON_NAME, "SECOND TEST SHPK"),
            x509.NameAttribute(NameOID.SURNAME, "Y88888888Y"),
            x509.NameAttribute(NameOID.TITLE, "Test"),
        ]
    )
    return pkcs12.serialize_key_and_certificates(
        b"second", test_key(), certificate, None, BestAvailableEncryption(b"second")
    )


def signer(fake: FakeCis) -> str:
    """Business id (certificate fingerprint) of the certificate that signed the last request."""
    request = fake.requests[-1][1]
    der = base64.b64decode(next(node.text for node in request.iter() if str(node.tag).endswith("X509Certificate")))
    return hashlib.sha256(der).hexdigest()[:16]


if __name__ == "__main__":
    unittest.main()
