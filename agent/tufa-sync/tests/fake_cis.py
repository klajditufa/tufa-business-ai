"""An offline stand-in for CIS, used by the tests.

It checks that every request is correctly signed, then answers with
responses shaped like the real ones (namespaces, attributes, faults), built
from deterministic sample data. Pass an instance as ``poster`` to CisClient.
"""

from __future__ import annotations

import base64
import uuid
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple

from lxml import etree

from cis_client.transport import SERVICES, SOAP_NS, child, local_name
from cis_client.xmlsig import verify_enveloped

BUSINESS = {"IDType": "NUIS", "IDNum": "X99999999X", "Name": "TEST ONLY SHPK", "Address": "Rruga e Testit 1",
            "Town": "Tiranë", "Country": "ALB"}
PARTNERS = [
    ("K11111111A", "ALFA TREGTI SHPK", "Durrës"),
    ("L22222222B", "BETA SHËRBIME SHPK", "Tiranë"),
    ("M33333333C", "GAMA DISTRIBUTION SHPK", "Shkodër"),
    ("J44444444D", "DELTA ÇELIK SHA", "Elbasan"),
]
ITEMS = [("Kafe ekspres", "XPP", "120.00"), ("Ujë mineral 0.5 L", "XPP", "60.00"), ("Shërbim mirëmbajtjeje", "HUR", "2500.00"),
         ("Letër A4 (pako)", "XPK", "650.00"), ("Detergjent 5 L", "LTR", "1450.00")]
MINIMAL_PDF = (
    b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
    b"4 0 obj<</Length 44>>stream\nBT /F1 18 Tf 40 70 Td (Test e-invoice) Tj ET\nendstream endobj\n"
    b"5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"
)
TIRANE_OFFSET = "+02:00"


def _money(value: float) -> str:
    return f"{value:.2f}"


class FakeCis:
    def __init__(self, invoices_per_day: int = 3, max_days: int = 31, fault: Optional[Tuple[str, str, str]] = None,
                 issued_for: Optional[str] = None):
        self.invoices_per_day = invoices_per_day
        self.max_days = max_days  # longer searches get fault 87, like CIS
        self.fault = fault  # (faultcode, faultstring, code) returned for every request
        self.issued_for = issued_for  # "test" or "production": the other environment refuses the certificate
        self.requests: List[Tuple[str, etree._Element]] = []
        self.registry: Dict[str, Tuple[str, date, int]] = {}  # FIC -> how to rebuild the invoice

    # Transport entry point ------------------------------------------------------

    def __call__(self, url: str, body: bytes, headers: Dict[str, str], timeout: float) -> Tuple[int, bytes]:
        root = etree.fromstring(body)
        request = next(item for item in child(root, "Body") if local_name(item))
        verify_enveloped(request)
        operation = local_name(request)[: -len("Request")]
        assert headers["SOAPAction"].endswith("/" + operation), headers["SOAPAction"]
        assert url == SERVICES[self._service(operation)].url("production") or url == SERVICES[self._service(operation)].url("test")
        self.requests.append((operation, request))
        request_uuid = child(request, "Header").get("UUID")
        if self.fault:
            return 500, self._fault(*self.fault)
        if self.issued_for and ("-test." in url) != (self.issued_for == "test"):
            return 500, self._fault("env:CLIENT", "Received certificate doesn't contain valid title value.", "34")
        namespace = etree.QName(request).namespace
        try:
            content = getattr(self, f"_{operation}")(request, namespace)
        except _Fault as fault:
            return 500, self._fault("env:CLIENT", fault.message, fault.code)
        return 200, self._envelope(operation, namespace, request_uuid, content)

    @staticmethod
    def _service(operation: str) -> str:
        return {"GetInvoices": "data", "GetTaxpayers": "einvoice", "GetEinvoices": "einvoice"}.get(operation, "fiscalization")

    @staticmethod
    def _envelope(operation: str, namespace: str, request_uuid: str, content: List[etree._Element]) -> bytes:
        envelope = etree.Element(f"{{{SOAP_NS}}}Envelope", nsmap={"SOAP-ENV": SOAP_NS})
        etree.SubElement(envelope, f"{{{SOAP_NS}}}Header")
        body = etree.SubElement(envelope, f"{{{SOAP_NS}}}Body")
        response = etree.SubElement(body, f"{{{namespace}}}{operation}Response",
                                    nsmap={"ns2": namespace, "ns3": "http://www.w3.org/2000/09/xmldsig#"},
                                    Id="Response", Version="3")
        etree.SubElement(response, f"{{{namespace}}}Header", RequestUUID=request_uuid,
                         SendDateTime=datetime.now().replace(microsecond=0).isoformat() + TIRANE_OFFSET,
                         UUID=str(uuid.uuid4()))
        for item in content:
            response.append(item)
        return etree.tostring(envelope, xml_declaration=True, encoding="UTF-8")

    @staticmethod
    def _fault(fault_code: str, message: str, code: str) -> bytes:
        return (
            '<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Header/><env:Body><env:Fault>'
            f"<faultcode>{fault_code}</faultcode><faultstring>{message} Code={code} RequestUUID=x ResponseUUID=y</faultstring>"
            f"<detail><code>{code}</code></detail></env:Fault></env:Body></env:Envelope>"
        ).encode("utf-8")

    # Operations -------------------------------------------------------------------

    def _GetInvoices(self, request: etree._Element, ns: str) -> List[etree._Element]:
        query = child(request, "InvoicesRequestBody")
        kind = query.get("InvTransactionType")
        container = etree.Element(f"{{{ns}}}Invoices")
        if query.get("FIC"):
            found = self.registry.get(query.get("FIC").lower())
            if found and found[0] == kind:
                container.append(self._invoice(ns, *found, detailed=True))
            container.set("count", str(len(container)))
            return [container]
        start = date.fromisoformat(query.get("FromDate")[:10])
        end = date.fromisoformat(query.get("ToDate")[:10])
        if start > end or (end - start).days + 1 > self.max_days:
            raise _Fault("Search period limit exceeded.", "87")
        keys = [(kind, start + timedelta(days=offset), index)
                for offset in range((end - start).days + 1) for index in range(self.invoices_per_day)]
        page = int(query.get("Page") or 1)
        for key in keys[(page - 1) * 1000: page * 1000]:
            container.append(self._invoice(ns, *key, detailed=False))
        container.set("count", str(len(keys)))
        return [container]

    def _invoice(self, ns: str, kind: str, day: date, index: int, detailed: bool) -> etree._Element:
        seed = day.toordinal() * 10 + index
        fic = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{kind}/{day}/{index}"))
        self.registry[fic] = (kind, day, index)
        partner = PARTNERS[seed % len(PARTNERS)]
        cash = seed % 3 == 0
        einvoice = not cash and seed % 2 == 0
        items = []
        for position in range(1 + seed % 3):
            name, unit, price = ITEMS[(seed + position) % len(ITEMS)]
            quantity = 1 + (seed + position) % 4
            net = float(price) * quantity
            items.append({"N": name, "C": f"A{(seed + position) % 90 + 10}", "U": unit, "Q": f"{quantity:.1f}",
                          "UPB": price, "UPA": _money(float(price) * 1.2), "R": "0.00", "RR": "true",
                          "PB": _money(net), "VR": "20.00", "VA": _money(net * 0.2), "PA": _money(net * 1.2)})
        net = sum(float(item["PB"]) for item in items)
        vat = sum(float(item["VA"]) for item in items)
        tcr = "ab123cd456"
        number = 1000 + day.timetuple().tm_yday * 10 + index
        issued = f"{day.isoformat()}T{9 + index % 9:02d}:{(seed * 7) % 60:02d}:00{TIRANE_OFFSET}"
        attributes = {
            "BusinUnitCode": "bu123bu123", "FIC": fic, "IIC": uuid.uuid5(uuid.NAMESPACE_DNS, fic).hex.upper(),
            "InvOrdNum": str(number), "IsEinvoice": "true" if einvoice else "false", "IsIssuerInVAT": "true",
            "IsReverseCharge": "false", "IsSimplifiedInv": "false", "IssueDateTime": issued,
            "OperatorCode": "op123op123", "SoftCode": "sw123sw123",
            "TotPrice": _money(net + vat), "TotVATAmt": _money(vat), "TypeOfInv": "CASH" if cash else "NONCASH",
        }
        if detailed:  # Like CIS, date range lists leave these out.
            attributes.update({
                "IICSignature": "AB" * 256, "InvNum": f"{number}/{day.year}/{tcr}" if cash else f"{number}/{day.year}",
                "SendDateTime": issued, "TotPriceWoVAT": _money(net),
            })
        if cash:
            attributes["TCRCode"] = tcr
        if einvoice:
            attributes["EIC"] = str(uuid.uuid5(uuid.NAMESPACE_OID, fic))
            attributes["PayDeadline"] = (day + timedelta(days=30)).isoformat()
        invoice = etree.Element(f"{{{ns}}}Inv", attributes)
        if detailed:
            payments = etree.SubElement(invoice, f"{{{ns}}}PayMethods")
            etree.SubElement(payments, f"{{{ns}}}PayMethod", Type="BANKNOTE" if cash else "ACCOUNT", Amt=_money(net + vat))
        partner_attributes = {"IDType": "NUIS", "IDNum": partner[0], "Name": partner[1], "Town": partner[2], "Country": "ALB"}
        seller, buyer = (BUSINESS, partner_attributes) if kind == "SALES" else (partner_attributes, BUSINESS)
        etree.SubElement(invoice, f"{{{ns}}}Seller", seller)
        if not (kind == "SALES" and cash and seed % 2):
            etree.SubElement(invoice, f"{{{ns}}}Buyer", buyer)
        if seed % 11 == 0:
            etree.SubElement(invoice, f"{{{ns}}}CorrectiveInv", IICRef="0" * 32, IssueDateTime=issued, Type="CORRECTIVE")
        if seed % 13 == 0:
            etree.SubElement(invoice, f"{{{ns}}}Currency", Code="EUR", ExRate="98.5")
        if detailed:
            container = etree.SubElement(invoice, f"{{{ns}}}Items")
            for item in items:
                etree.SubElement(container, f"{{{ns}}}I", item)
            taxes = etree.SubElement(invoice, f"{{{ns}}}SameTaxes")
            etree.SubElement(taxes, f"{{{ns}}}SameTax", NumOfItems=str(len(items)), PriceBefVAT=_money(net),
                             VATRate="20.00", VATAmt=_money(vat))
        return invoice

    def _GetTaxpayers(self, request: etree._Element, ns: str) -> List[etree._Element]:
        search = child(request, "Filter")
        tin, name = child(search, "Tin"), child(search, "Name")
        container = etree.Element(f"{{{ns}}}Taxpayers")
        for nipt, title, town in PARTNERS + [(BUSINESS["IDNum"], BUSINESS["Name"], BUSINESS["Town"])]:
            if (tin is not None and tin.text == nipt) or (name is not None and name.text.lower() in title.lower()):
                etree.SubElement(container, f"{{{ns}}}Taxpayer", Tin=nipt, Name=title, Address=f"Rruga {town} 12",
                                 Town=town, Country="ALB")
        return [container]

    def _GetOperators(self, request: etree._Element, ns: str) -> List[etree._Element]:
        container = etree.Element(f"{{{ns}}}Operators")
        etree.SubElement(container, f"{{{ns}}}Operator", OprCode="op123op123", OprFirstName="Arta",
                         OprLastName="Hoxha", OprID="I00000000A", OprValidFrom="2024-01-01")
        etree.SubElement(container, f"{{{ns}}}Operator", OprCode="op456op456", OprFirstName="Blerim",
                         OprLastName="Kola", OprID="I00000000B", OprValidFrom="2023-03-01", OprValidTo="2025-12-31")
        return [container]

    def _GetBusinessUnits(self, request: etree._Element, ns: str) -> List[etree._Element]:
        container = etree.Element(f"{{{ns}}}BusinessUnits")
        etree.SubElement(container, f"{{{ns}}}BusinessUnit", BUCode="bu123bu123", BUName="Pika qendrore",
                         BUSerialNumber="1", BUStreetName="Rruga e Testit 1, Tiranë", BUValidFrom="2021-01-01")
        return [container]

    def _GetTCRs(self, request: etree._Element, ns: str) -> List[etree._Element]:
        container = etree.Element(f"{{{ns}}}TCRs")
        etree.SubElement(container, f"{{{ns}}}TCR", IssuerNUIS=BUSINESS["IDNum"], BusinUnitCode="bu123bu123",
                         TCRIntID="ARKA-1", SoftCode="sw123sw123", TCRCode="ab123cd456", MaintainerCode="mt123mt123",
                         ValidFrom="2021-01-01", Type="REGULAR")
        return [container]

    def _GetEinvoices(self, request: etree._Element, ns: str) -> List[etree._Element]:
        eic = (child(request, "EIC").text or "").lower()
        container = etree.Element(f"{{{ns}}}Einvoices")
        party = child(request, "PartyType").text
        einvoice = etree.SubElement(container, f"{{{ns}}}Einvoice", EIC=eic, DocNumber="1001/2026", Status="DELIVERED",
                                    Amount="1200.00", BuyerTin="K11111111A", SellerTin=BUSINESS["IDNum"],
                                    PartyType=party, RecDateTime="2026-09-15T12:00:00+02:00",
                                    DueDateTime="2026-10-15T12:00:00+02:00")
        etree.SubElement(einvoice, f"{{{ns}}}Pdf").text = base64.b64encode(MINIMAL_PDF).decode("ascii")
        return [container]


class _Fault(Exception):
    def __init__(self, message: str, code: str):
        super().__init__(message)
        self.message = message
        self.code = code
