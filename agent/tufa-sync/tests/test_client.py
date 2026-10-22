from __future__ import annotations

import re
import unittest
from decimal import Decimal
from unittest import mock

from cis_client import CisClient, CisFault, PURCHASES, SALES, TransportError, ValidationError, verification_url
from cis_client.convert import net_amount
from cis_client.transport import child

from .fake_cis import BUSINESS, FakeCis
from .helpers import load_test_certificate

TIMESTAMP = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$")


def client(fake: FakeCis, environment: str = "test") -> CisClient:
    return CisClient(load_test_certificate(), environment, poster=fake, retries=0)


class InvoiceTest(unittest.TestCase):
    def test_sales_page(self) -> None:
        fake = FakeCis(invoices_per_day=2)
        page = client(fake).get_sales("2026-09-01", "2026-09-30")
        self.assertEqual(page.count, 60)
        self.assertEqual(len(page.invoices), 60)
        self.assertFalse(page.has_more)
        invoice = page.invoices[0]
        self.assertEqual(invoice["Seller"]["IDNum"], BUSINESS["IDNum"])
        self.assertIsInstance(invoice["TotPrice"], str)
        self.assertNotIn("Items", invoice)  # lists come without items
        self.assertNotIn("TotPriceWoVAT", invoice)  # ...and without the net total
        self.assertEqual(Decimal(net_amount(invoice)), Decimal(invoice["TotPrice"]) - Decimal(invoice["TotVATAmt"]))
        self.assertEqual(list(invoice)[0], "TypeOfInv")  # schema key order

        operation, request = fake.requests[-1]
        query = child(request, "InvoicesRequestBody")
        self.assertEqual(operation, "GetInvoices")
        self.assertEqual(query.get("InvTransactionType"), "SALES")
        self.assertTrue(query.get("FromDate").startswith("2026-09-01T00:00:00"))
        self.assertTrue(query.get("ToDate").startswith("2026-09-30T23:59:59"))
        self.assertRegex(child(request, "Header").get("SendDateTime"), TIMESTAMP)

    def test_purchases_party(self) -> None:
        page = client(FakeCis()).get_purchases("2026-09-01", "2026-09-01")
        self.assertTrue(all(item["Buyer"]["IDNum"] == BUSINESS["IDNum"] for item in page.invoices))

    def test_default_period_is_current_month(self) -> None:
        fake = FakeCis()
        client(fake).get_sales()
        query = child(fake.requests[-1][1], "InvoicesRequestBody")
        self.assertRegex(query.get("FromDate"), r"^\d{4}-\d{2}-01T00:00:00")

    def test_invoice_by_fic_has_items(self) -> None:
        fake = FakeCis()
        cis = client(fake)
        listed = cis.get_purchases("2026-09-10", "2026-09-10").invoices[0]
        invoice = cis.get_invoice(listed["FIC"].upper(), PURCHASES)
        self.assertEqual(invoice["FIC"], listed["FIC"])
        self.assertTrue(invoice["Items"])
        self.assertTrue(set(invoice["Items"][0]) >= {"N", "Q", "UPB", "PA"})
        self.assertIsInstance(invoice["PayMethods"], list)
        self.assertEqual(net_amount(invoice), invoice["TotPriceWoVAT"])
        self.assertIsNone(cis.get_invoice(listed["FIC"], SALES))  # wrong direction: not found
        self.assertEqual(child(fake.requests[-1][1], "InvoicesRequestBody").get("FIC"), listed["FIC"].lower())

    def test_fetch_all_pages(self) -> None:
        fake = FakeCis(invoices_per_day=40)
        invoices = client(fake).fetch_all_invoices(SALES, "2026-09-01", "2026-09-30")
        self.assertEqual(len(invoices), 1200)
        self.assertEqual(len({item["FIC"] for item in invoices}), 1200)
        pages = [child(request, "InvoicesRequestBody").get("Page") for _, request in fake.requests]
        self.assertEqual(pages, ["1", "2"])

    def test_fetch_all_splits_long_ranges(self) -> None:
        fake = FakeCis(invoices_per_day=1, max_days=31)
        progress = []
        invoices = client(fake).fetch_all_invoices(SALES, "2026-01-01", "2026-06-30", lambda *args: progress.append(args))
        self.assertEqual(len(invoices), 181)
        self.assertEqual(len({item["FIC"] for item in invoices}), 181)
        days = sorted(item["IssueDateTime"][:10] for item in invoices)
        self.assertEqual((days[0], days[-1]), ("2026-01-01", "2026-06-30"))
        self.assertEqual(progress[-1][0], 181)

    def test_single_page_reports_fault_87(self) -> None:
        with self.assertRaises(CisFault) as caught:
            client(FakeCis(max_days=31)).get_sales("2026-01-01", "2026-12-31")
        self.assertEqual(caught.exception.fault_code, "87")
        self.assertIn("shorter date range", caught.exception.hint)

    def test_validation(self) -> None:
        cis = client(FakeCis())
        with self.assertRaises(ValidationError) as caught:
            cis.get_sales("2026-09-30", "2026-09-01")
        self.assertEqual(caught.exception.field, "ToDate")
        with self.assertRaises(ValidationError):
            cis.get_sales("30/09/2026")
        with self.assertRaises(ValidationError):
            cis.get_sales(page=0)
        with self.assertRaises(ValidationError):
            cis.get_invoice("not-a-uuid", SALES)
        with self.assertRaises(ValidationError):
            cis.get_invoices("RETURNS")

    def test_verification_url(self) -> None:
        invoice = client(FakeCis()).get_sales("2026-09-02", "2026-09-02").invoices[0]
        url = verification_url(invoice, "production")
        self.assertTrue(url.startswith("https://efiskalizimi-app.tatime.gov.al/invoice-check/#/verify?iic="))
        self.assertIn(f"tin={BUSINESS['IDNum']}", url)
        self.assertIn("efiskalizimi-app-test", verification_url(invoice, "test"))


class RegistryTest(unittest.TestCase):
    def test_taxpayers(self) -> None:
        fake = FakeCis()
        cis = client(fake)
        self.assertEqual([item["Tin"] for item in cis.get_taxpayers("k11111111a")], ["K11111111A"])
        self.assertEqual(child(child(fake.requests[-1][1], "Filter"), "Tin").text, "K11111111A")
        names = cis.get_taxpayers("  shpk ")
        self.assertGreaterEqual(len(names), 3)
        self.assertEqual(child(child(fake.requests[-1][1], "Filter"), "Name").text, "shpk")
        for term in ("ab", "x" * 101, ""):
            with self.assertRaises(ValidationError):
                cis.get_taxpayers(term)

    def test_operators(self) -> None:
        operators = client(FakeCis()).get_operators()
        self.assertEqual(operators[0]["name"], "Arta Hoxha")
        self.assertEqual(operators[0]["opCode"], "op123op123")
        self.assertIsNone(operators[0]["validTo"])
        self.assertEqual(operators[1]["validTo"], "2025-12-31")

    def test_business_units_and_tcrs(self) -> None:
        cis = client(FakeCis())
        self.assertEqual(cis.get_business_units()[0]["BUCode"], "bu123bu123")
        self.assertEqual(cis.get_tcrs()[0]["IssuerNUIS"], BUSINESS["IDNum"])

    def test_einvoice_pdf(self) -> None:
        fake = FakeCis()
        document = client(fake).get_einvoice_pdf("2ED48EFF-F3D0-4315-A2A5-16618C63AD0B", "seller")
        self.assertTrue(document.pdf.startswith(b"%PDF-"))
        self.assertEqual(document.details["Status"], "DELIVERED")
        self.assertEqual(child(fake.requests[-1][1], "PartyType").text, "SELLER")
        with self.assertRaises(ValidationError):
            client(fake).get_einvoice_pdf("2ed48eff-f3d0-4315-a2a5-16618c63ad0b", "OWNER")


class FaultTest(unittest.TestCase):
    def test_fault_details(self) -> None:
        fake = FakeCis(fault=("env:CLIENT", "Certificate has expired.", "36"))
        with self.assertRaises(CisFault) as caught:
            client(fake).get_operators()
        fault = caught.exception
        self.assertEqual((fault.fault_env, fault.fault_code), ("env:CLIENT", "36"))
        self.assertEqual(fault.fault_string, "Certificate has expired.")  # CIS noise removed
        self.assertTrue(fault.is_client_error)
        self.assertIn("expired", fault.hint)
        self.assertEqual(fault.to_dict(), {"faultEnv": "env:CLIENT", "faultString": "Certificate has expired.", "faultCode": "36"})

    def test_server_fault_is_retried(self) -> None:
        fake = FakeCis()
        calls = []

        def flaky(url, body, headers, timeout):
            calls.append(re.search(rb'UUID="([^"]+)"', body).group(1))
            if len(calls) == 1:
                return 500, FakeCis._fault("env:SERVER", "Temporary problem.", "999")
            return fake(url, body, headers, timeout)

        cis = CisClient(load_test_certificate(), "test", poster=flaky, retries=2)
        with mock.patch("cis_client.transport.time.sleep") as sleep:
            self.assertEqual(len(cis.get_operators()), 2)
        self.assertEqual(len(calls), 2)
        sleep.assert_called_once()
        self.assertNotEqual(calls[0], calls[1])  # each attempt is a fresh, newly signed message

    def test_client_fault_is_not_retried(self) -> None:
        fake = FakeCis(fault=("env:CLIENT", "Bad.", "11"))
        cis = CisClient(load_test_certificate(), "test", poster=fake, retries=3)
        with mock.patch("cis_client.transport.time.sleep"):
            with self.assertRaises(CisFault):
                cis.get_tcrs()
        self.assertEqual(len(fake.requests), 1)

    def test_network_error(self) -> None:
        def offline(url, body, headers, timeout):
            raise OSError("Network is unreachable")

        cis = CisClient(load_test_certificate(), "test", poster=offline, retries=1)
        with mock.patch("cis_client.transport.time.sleep"):
            with self.assertRaisesRegex(TransportError, "Cannot reach CIS"):
                cis.get_tcrs()

    def test_response_must_echo_request_uuid(self) -> None:
        fake = FakeCis()

        def mismatched(url, body, headers, timeout):
            status, data = fake(url, body, headers, timeout)
            return status, re.sub(rb'RequestUUID="[^"]+"', b'RequestUUID="00000000-0000-4000-8000-000000000000"', data)

        with self.assertRaisesRegex(TransportError, "RequestUUID"):
            CisClient(load_test_certificate(), "test", poster=mismatched, retries=0).get_tcrs()

    def test_rejects_doctype(self) -> None:
        def hostile(url, body, headers, timeout):
            return 200, b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><x>&a;</x>'

        with self.assertRaisesRegex(TransportError, "DOCTYPE"):
            CisClient(load_test_certificate(), "test", poster=hostile, retries=0).get_tcrs()

    def test_not_soap(self) -> None:
        def html(url, body, headers, timeout):
            return 502, b"<html><body>Bad gateway</body></html>"

        with self.assertRaisesRegex(TransportError, "HTTP 502"):
            CisClient(load_test_certificate(), "test", poster=html, retries=0).get_tcrs()

    def test_environment_urls(self) -> None:
        seen = []
        fake = FakeCis()

        def record(url, body, headers, timeout):
            seen.append(url)
            return fake(url, body, headers, timeout)

        CisClient(load_test_certificate(), "production", poster=record).get_operators()
        CisClient(load_test_certificate(), "test", poster=record).get_taxpayers("alfa")
        self.assertEqual(seen, [
            "https://efiskalizimi.tatime.gov.al/FiscalizationService-v3",
            "https://einvoice-test.tatime.gov.al/EinvoiceService-v1",
        ])
        with self.assertRaises(ValidationError):
            CisClient(load_test_certificate(), "staging")
        self.assertEqual(CisClient(load_test_certificate()).environment, "test")  # from the certificate


if __name__ == "__main__":
    unittest.main()
