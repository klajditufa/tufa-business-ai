"""The TUFA push: a fake TUFA server records what the agent sends."""

from __future__ import annotations

import contextlib
import io
import json
import os
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from unittest import mock

from cis_client import cli, tufa
from cis_client.client import CisClient
from cis_client.tufa import TufaClient, TufaError

from .fake_cis import FakeCis
from .helpers import TEST_P12, TEST_P12_PASSWORD

GOOD_KEY = "tba_" + "ab" * 24


class FakeTufa(BaseHTTPRequestHandler):
    received = []
    company = {"id": "c1", "nipt": "X99999999X", "legal_name": "TEST SHPK"}

    def _auth_ok(self) -> bool:
        return self.headers.get("Authorization") == f"Bearer {GOOD_KEY}"

    def _send(self, status: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        if self.path != "/api/sync/invoices" or not self._auth_ok():
            return self._send(401, {"ok": False, "error": "bad key"})
        self._send(200, {"ok": True, "company": self.company})

    def do_POST(self) -> None:
        if not self._auth_ok():
            return self._send(401, {"ok": False, "error": "bad key"})
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        FakeTufa.received.append(body)
        if self.path == "/api/sync/registry":
            return self._send(200, {"ok": True, "kind": body["kind"], "rows": len(body["rows"])})
        invoices = body["invoices"]
        with_fic = [i for i in invoices if i.get("FIC")]
        self._send(
            200,
            {
                "ok": True,
                "batch_id": "b1",
                "imported": len(with_fic),
                "updated": 0,
                "skipped": len(invoices) - len(with_fic),
                "errors": [{"fic": None, "message": "Fatura pa FIC"}] * (len(invoices) - len(with_fic)),
            },
        )

    def log_message(self, *args) -> None:  # silence
        pass


class TufaTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = HTTPServer(("127.0.0.1", 0), FakeTufa)
        cls.url = f"http://localhost:{cls.server.server_port}"
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()

    def setUp(self) -> None:
        FakeTufa.received.clear()

    def test_rejects_bad_configuration(self) -> None:
        with self.assertRaises(TufaError):
            TufaClient("http://insecure.example", GOOD_KEY)
        with self.assertRaises(TufaError):
            TufaClient("https://tufa.example", "not-a-key")

    def test_check_and_push_in_batches(self) -> None:
        client = TufaClient(self.url, GOOD_KEY)
        self.assertEqual(client.check()["company"]["nipt"], "X99999999X")
        rows = [{"FIC": f"f{i}", "TotPrice": "1.00"} for i in range(tufa.BATCH_SIZE + 3)] + [{"TotPrice": "2.00"}]
        result = client.push("SALES", rows, label="test")
        self.assertEqual(
            (result.sent, result.batches, result.imported, result.skipped), (len(rows), 2, len(rows) - 1, 1)
        )
        self.assertEqual(len(FakeTufa.received), 2)
        self.assertEqual(FakeTufa.received[0]["direction"], "sale")
        self.assertEqual(len(FakeTufa.received[0]["invoices"]), tufa.BATCH_SIZE)
        self.assertEqual(result.errors[0]["message"], "Fatura pa FIC")

    def test_wrong_key_is_a_clear_error(self) -> None:
        with self.assertRaises(TufaError) as ctx:
            TufaClient(self.url, "tba_wrong").check()
        self.assertIn("401", str(ctx.exception))

    def test_cli_push(self) -> None:
        stdout, stderr = io.StringIO(), io.StringIO()
        fake = FakeCis()

        def offline_client(certificate, environment, **options):
            return CisClient(certificate, environment, poster=fake, retries=0)

        environment = {
            "CIS_CERT_PASSWORD": TEST_P12_PASSWORD,
            "CIS_CERT": str(TEST_P12),
            "TUFA_URL": self.url,
            "TUFA_API_KEY": GOOD_KEY,
        }
        with (
            mock.patch.dict(os.environ, environment),
            mock.patch.object(cli, "CisClient", offline_client),
            contextlib.redirect_stdout(stdout),
            contextlib.redirect_stderr(stderr),
        ):
            code = cli.main(["push", "--from", "2026-09-01", "--to", "2026-09-02", "--format", "json"])
        self.assertEqual(code, 0, stderr.getvalue())
        summary = json.loads(stdout.getvalue())
        self.assertEqual([s["direction"] for s in summary], ["sale", "purchase"])
        self.assertEqual(summary[0]["sent"], 6)
        self.assertIn("key accepted for TEST SHPK", stderr.getvalue())
        self.assertEqual({b["direction"] for b in FakeTufa.received}, {"sale", "purchase"})
        # The certificate itself never travels: only invoice JSON.
        for body in FakeTufa.received:
            self.assertEqual(set(body), {"direction", "invoices", "label"})

    def test_cli_push_details_sends_items(self) -> None:
        stderr = io.StringIO()
        fake = FakeCis()
        environment = {
            "CIS_CERT_PASSWORD": TEST_P12_PASSWORD,
            "CIS_CERT": str(TEST_P12),
            "TUFA_URL": self.url,
            "TUFA_API_KEY": GOOD_KEY,
        }
        with (
            mock.patch.dict(os.environ, environment),
            mock.patch.object(cli, "CisClient", lambda c, e, **o: CisClient(c, e, poster=fake, retries=0)),
            contextlib.redirect_stderr(stderr),
        ):
            code = cli.main(["push", "sales", "--details", "--from", "2026-09-01", "--to", "2026-09-02"])
        self.assertEqual(code, 0, stderr.getvalue())
        sent = [inv for body in FakeTufa.received for inv in body["invoices"]]
        self.assertTrue(sent)
        self.assertTrue(all("Items" in inv for inv in sent if inv.get("FIC")), "complete invoices carry their items")

    def test_cli_push_refuses_nipt_mismatch(self) -> None:
        stderr = io.StringIO()
        fake = FakeCis()
        environment = {
            "CIS_CERT_PASSWORD": TEST_P12_PASSWORD,
            "CIS_CERT": str(TEST_P12),
            "TUFA_URL": self.url,
            "TUFA_API_KEY": GOOD_KEY,
        }
        with (
            mock.patch.dict(os.environ, environment),
            mock.patch.dict(FakeTufa.company, {"nipt": "J00000000A"}),
            mock.patch.object(cli, "CisClient", lambda c, e, **o: CisClient(c, e, poster=fake, retries=0)),
            contextlib.redirect_stderr(stderr),
        ):
            code = cli.main(["push"])
        self.assertEqual(code, 1)
        self.assertIn("does not match", stderr.getvalue())
        self.assertEqual(FakeTufa.received, [])

    def test_cli_push_registry(self) -> None:
        stdout, stderr = io.StringIO(), io.StringIO()
        fake = FakeCis()
        environment = {
            "CIS_CERT_PASSWORD": TEST_P12_PASSWORD,
            "CIS_CERT": str(TEST_P12),
            "TUFA_URL": self.url,
            "TUFA_API_KEY": GOOD_KEY,
        }
        with (
            mock.patch.dict(os.environ, environment),
            mock.patch.object(cli, "CisClient", lambda c, e, **o: CisClient(c, e, poster=fake, retries=0)),
            contextlib.redirect_stdout(stdout),
            contextlib.redirect_stderr(stderr),
        ):
            code = cli.main(["push-registry", "--format", "json"])
        self.assertEqual(code, 0, stderr.getvalue())
        self.assertEqual([b["kind"] for b in FakeTufa.received], ["units", "tcrs", "operators"])
        self.assertTrue(all(isinstance(b["rows"], list) for b in FakeTufa.received))
        self.assertEqual([s["kind"] for s in json.loads(stdout.getvalue())], ["units", "tcrs", "operators"])

    def test_push_registry_rejects_unknown_kind(self) -> None:
        with self.assertRaises(TufaError):
            TufaClient(self.url, GOOD_KEY).push_registry("passwords", [])


if __name__ == "__main__":
    unittest.main()
