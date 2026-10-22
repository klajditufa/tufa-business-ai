from __future__ import annotations

import contextlib
import csv
import io
import json
import os
import unittest
from unittest import mock

from cis_client import cli
from cis_client.client import CisClient
from cis_client.convert import CSV_COLUMNS

from .fake_cis import FakeCis
from .helpers import TEST_P12, TEST_P12_PASSWORD


def run(*argv: str):
    stdout, stderr = io.StringIO(), io.StringIO()
    fake = FakeCis()

    def offline_client(certificate, environment, **options):
        return CisClient(certificate, environment, poster=fake, retries=0)

    environment = {"CIS_CERT_PASSWORD": TEST_P12_PASSWORD, "CIS_CERT": str(TEST_P12)}
    with mock.patch.dict(os.environ, environment), mock.patch.object(cli, "CisClient", offline_client), \
            contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        code = cli.main(list(argv))
    return code, stdout.getvalue(), stderr.getvalue()


class CliTest(unittest.TestCase):
    def test_info(self) -> None:
        code, out, _ = run("info", "--cert", str(TEST_P12))
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)["nipt"], "X99999999X")

    def test_sales_table(self) -> None:
        code, out, err = run("sales", "--from", "2026-09-01", "--to", "2026-09-02")
        self.assertEqual(code, 0)
        self.assertIn("Buyer NIPT", out.splitlines()[0])
        self.assertIn("6 shown, 6 in total", err)

    def test_purchases_csv(self) -> None:
        code, out, _ = run("purchases", "--from", "2026-09-01", "--to", "2026-09-01", "--format", "csv")
        self.assertEqual(code, 0)
        rows = list(csv.DictReader(io.StringIO(out)))
        self.assertEqual(list(rows[0]), list(CSV_COLUMNS))
        self.assertEqual(rows[0]["BuyerNIPT"], "X99999999X")
        self.assertTrue(rows[0]["VerificationUrl"].startswith("https://efiskalizimi-app-test.tatime.gov.al/"))

    def test_operators_json(self) -> None:
        code, out, _ = run("operators", "--format", "json")
        self.assertEqual((code, json.loads(out)[0]["opCode"]), (0, "op123op123"))

    def test_errors(self) -> None:
        code, _, err = run("sales", "--from", "2026-09-30", "--to", "2026-09-01")
        self.assertEqual(code, 1)
        self.assertIn("ToDate must not be before FromDate", err)
        code, _, err = run("sales", "--from", "2025-01-01", "--to", "2026-12-31")
        self.assertEqual(code, 1)
        self.assertIn("code 87", err)
        self.assertIn("Hint:", err)

    def test_csv_cells_cannot_be_formulas(self) -> None:
        text = cli.render_csv([{"a": "=HYPERLINK(1)", "b": "-12.50", "c": "@x", "d": "ok"}], ["a", "b", "c", "d"])
        self.assertEqual(text.splitlines()[1], "'=HYPERLINK(1),-12.50,'@x,ok")


if __name__ == "__main__":
    unittest.main()
