from __future__ import annotations

import base64
import hashlib
import unittest

from lxml import etree

from cis_client import transport
from cis_client.errors import SignatureError
from cis_client.xmlsig import DS_NS, canonicalize, verify_enveloped

from .helpers import FIXTURES, SCHEMAS, load_test_certificate

GOLDEN = FIXTURES / "golden"
UUID = "8f1f5b8e-2c7a-4d4e-9a51-0f3c2b1a7e6d"
WHEN = "2026-09-30T10:15:00+02:00"
SCHEMA_FILES = {
    "data": SCHEMAS / "FiscalizationDataService" / "fiscalizationData.xsd",
    "fiscalization": SCHEMAS / "FiscalizationService" / "alimc-fiscalization-service.xsd",
    "einvoice": SCHEMAS / "EinvoiceService" / "alimc-einvoice-service.xsd",
}


def sales_body(request: etree._Element, namespace: str) -> None:
    etree.SubElement(request, f"{{{namespace}}}InvoicesRequestBody", {
        "FromDate": "2026-09-01T00:00:00+02:00",
        "ToDate": "2026-09-30T23:59:59+02:00",
        "InvTransactionType": "SALES",
        "Page": "1",
    })


def request_element(envelope: bytes) -> etree._Element:
    return etree.fromstring(envelope).find(f"{{{transport.SOAP_NS}}}Body")[0]


class GoldenTest(unittest.TestCase):
    """The signed messages are deterministic, so a port can be checked byte for byte."""

    def setUp(self) -> None:
        self.certificate = load_test_certificate()

    def test_get_invoices_matches_golden(self) -> None:
        envelope, request_uuid = transport.build_request(transport.GET_INVOICES, self.certificate, sales_body, UUID, WHEN)
        self.assertEqual(request_uuid, UUID)
        self.assertEqual(envelope, (GOLDEN / "GetInvoicesRequest.signed.xml").read_bytes())

    def test_get_operators_matches_golden(self) -> None:
        envelope, _ = transport.build_request(transport.GET_OPERATORS, self.certificate, None, UUID, WHEN)
        self.assertEqual(envelope, (GOLDEN / "GetOperatorsRequest.signed.xml").read_bytes())

    def test_intermediate_values(self) -> None:
        request = request_element((GOLDEN / "GetInvoicesRequest.signed.xml").read_bytes())
        signature = request.find(f"{{{DS_NS}}}Signature")
        unsigned = etree.fromstring(etree.tostring(request))
        unsigned.remove(unsigned.find(f"{{{DS_NS}}}Signature"))
        canonical = (GOLDEN / "GetInvoicesRequest.c14n.xml").read_bytes()
        self.assertEqual(canonicalize(unsigned), canonical)
        digest = base64.b64encode(hashlib.sha256(canonical).digest()).decode()
        self.assertEqual(signature.findtext(f".//{{{DS_NS}}}DigestValue"), digest)
        self.assertEqual(canonicalize(signature.find(f"{{{DS_NS}}}SignedInfo")),
                         (GOLDEN / "GetInvoicesRequest.SignedInfo.c14n.xml").read_bytes())


class SchemaTest(unittest.TestCase):
    """Every request validates against the official CIS schemas."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.certificate = load_test_certificate()
        cls.schemas = {name: etree.XMLSchema(etree.parse(str(path))) for name, path in SCHEMA_FILES.items()}

    def check(self, operation: transport.Operation, body=None) -> None:
        envelope, _ = transport.build_request(operation, self.certificate, body)
        request = request_element(envelope)
        schema = self.schemas[operation.service]
        self.assertTrue(schema.validate(request), schema.error_log)
        verify_enveloped(request)

    def test_get_invoices_by_period(self) -> None:
        self.check(transport.GET_INVOICES, sales_body)

    def test_get_invoices_by_fic(self) -> None:
        self.check(transport.GET_INVOICES, lambda request, ns: etree.SubElement(
            request, f"{{{ns}}}InvoicesRequestBody", FIC="2ed48eff-f3d0-4315-a2a5-16618c63ad0b", InvTransactionType="PURCHASES"))

    def test_registry_lookups(self) -> None:
        for operation in (transport.GET_OPERATORS, transport.GET_BUSINESS_UNITS, transport.GET_TCRS):
            self.check(operation)

    def test_get_taxpayers(self) -> None:
        def body(request: etree._Element, ns: str) -> None:
            search = etree.SubElement(request, f"{{{ns}}}Filter")
            etree.SubElement(search, f"{{{ns}}}Name").text = "Vodafone"
        self.check(transport.GET_TAXPAYERS, body)

    def test_get_einvoices(self) -> None:
        def body(request: etree._Element, ns: str) -> None:
            etree.SubElement(request, f"{{{ns}}}EIC").text = "2ed48eff-f3d0-4315-a2a5-16618c63ad0b"
            etree.SubElement(request, f"{{{ns}}}PartyType").text = "BUYER"
        self.check(transport.GET_EINVOICES, body)


class VerificationTest(unittest.TestCase):
    def setUp(self) -> None:
        envelope = (GOLDEN / "GetInvoicesRequest.signed.xml").read_bytes()
        self.request = request_element(envelope)

    def test_valid(self) -> None:
        certificate = verify_enveloped(self.request)
        self.assertEqual(certificate, load_test_certificate().x509)

    def test_tampered_content(self) -> None:
        self.request[1].set("InvTransactionType", "PURCHASES")
        with self.assertRaisesRegex(SignatureError, "Digest"):
            verify_enveloped(self.request)

    def test_tampered_signed_info(self) -> None:
        signed_info = self.request.find(f".//{{{DS_NS}}}SignedInfo")
        signed_info.find(f"{{{DS_NS}}}Reference").set("URI", "#Other")
        with self.assertRaises(SignatureError):
            verify_enveloped(self.request)

    def test_tampered_value(self) -> None:
        value = self.request.find(f".//{{{DS_NS}}}SignatureValue")
        raw = bytearray(base64.b64decode(value.text))
        raw[10] ^= 1
        value.text = base64.b64encode(bytes(raw)).decode()
        with self.assertRaisesRegex(SignatureError, "not valid"):
            verify_enveloped(self.request)

    def test_unsigned(self) -> None:
        self.request.remove(self.request.find(f"{{{DS_NS}}}Signature"))
        with self.assertRaises(SignatureError):
            verify_enveloped(self.request)


if __name__ == "__main__":
    unittest.main()
