"""Turning CIS XML responses into plain, JSON ready Python values.

Invoices keep CIS's own attribute names, and every scalar stays a string
exactly as CIS sent it ("120.00", "true"). Nested elements become objects and
repeated elements become lists:

    <Inv TotPrice="120.00" ...>                {"TotPrice": "120.00", ...,
      <PayMethods>                              "PayMethods": [{"Type": "ACCOUNT", "Amt": "120.00"}],
        <PayMethod Type="ACCOUNT" Amt="120.00"/>
      </PayMethods>
      <Seller IDType="NUIS" IDNum="..." .../>   "Seller": {"IDType": "NUIS", ...}}
    </Inv>
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlencode

from lxml import etree

from .transport import child, local_name

# Wrapper elements whose children form a list, mapped to the child element name.
LIST_CONTAINERS: Dict[str, str] = {
    "PayMethods": "PayMethod",
    "Vouchers": "Voucher",
    "SameTaxes": "SameTax",
    "Fees": "Fee",
    "SumInvIICRefs": "SumInvIICRef",
    "Items": "I",
    "VN": "V",
}

# Preferred key order for invoices (schema order); unknown attributes follow.
INVOICE_KEY_ORDER = (
    "TypeOfInv", "IsSimplifiedInv", "IsBadDeb", "TypeOfSelfIss", "IssueDateTime", "SendDateTime",
    "InvNum", "InvOrdNum", "TCRCode", "IsIssuerInVAT", "TaxFreeAmt", "MarkUpAmt", "GoodsExAmt",
    "TotPriceWoVAT", "TotVATAmt", "TotPrice", "OperatorCode", "BusinUnitCode", "SoftCode",
    "ImpCustDecNum", "IIC", "IICSignature", "FIC", "IsReverseCharge", "PayDeadline", "IsEinvoice", "EIC",
    "PayMethods", "Seller", "Buyer", "Currency", "SupplyDateOrPeriod", "CorrectiveInv", "BadDebtInv",
    "SameTaxes", "Fees", "SumInvIICRefs", "Items",
)


def element_to_dict(node: etree._Element) -> dict:
    """Attributes become string values; child elements become nested dicts or lists."""
    result: dict = dict(node.attrib)
    for item in node:
        name = local_name(item)
        if not name:
            continue
        if name in LIST_CONTAINERS:
            result[name] = [element_to_dict(entry) for entry in item if local_name(entry) == LIST_CONTAINERS[name]]
        else:
            result[name] = element_to_dict(item)
    return result


def invoice_to_dict(node: etree._Element) -> dict:
    value = element_to_dict(node)
    if not value.get("Items"):
        value.pop("Items", None)  # Date range lists come without items.
    ordered = {key: value[key] for key in INVOICE_KEY_ORDER if key in value}
    ordered.update((key, item) for key, item in value.items() if key not in ordered)
    return ordered


def invoices_from_response(response: etree._Element) -> Tuple[List[dict], int]:
    """Invoices in a GetInvoicesResponse and the total count CIS reports for the search."""
    container = child(response, "Invoices")
    if container is None:
        return [], 0
    invoices = [invoice_to_dict(node) for node in container if local_name(node) == "Inv"]
    try:
        count = int(container.get("count") or len(invoices))
    except ValueError:
        count = len(invoices)
    return invoices, max(count, len(invoices))


def taxpayers_from_response(response: etree._Element) -> List[dict]:
    container = child(response, "Taxpayers")
    if container is None:
        return []
    keys = ("Tin", "Name", "Address", "Town", "Country")
    return [
        {key: node.get(key, "") for key in keys}
        for node in container
        if local_name(node) == "Taxpayer"
    ]


def operators_from_response(response: etree._Element) -> List[dict]:
    """Operators as ``{"name", "opCode", ...}``; ``opCode`` is the OperatorCode used when fiscalizing."""
    container = child(response, "Operators")
    if container is None:
        return []
    result = []
    for node in container:
        if local_name(node) != "Operator":
            continue
        first, last = node.get("OprFirstName", ""), node.get("OprLastName", "")
        result.append({
            "name": " ".join(part for part in (first, last) if part),
            "opCode": node.get("OprCode", ""),
            "firstName": first,
            "lastName": last,
            "idNumber": node.get("OprID", ""),
            "validFrom": node.get("OprValidFrom"),
            "validTo": node.get("OprValidTo"),
        })
    return result


def list_from_response(response: etree._Element, container_name: str, item_name: str) -> List[dict]:
    """Generic list of attribute dicts, used for business units and TCRs."""
    container = child(response, container_name)
    if container is None:
        return []
    return [dict(node.attrib) for node in container if local_name(node) == item_name]


def net_amount(invoice: dict) -> str:
    """TotPriceWoVAT, or TotPrice - TotVATAmt when CIS leaves it out (date range lists do)."""
    if invoice.get("TotPriceWoVAT"):
        return invoice["TotPriceWoVAT"]
    try:
        return str((Decimal(invoice.get("TotPrice") or "0") - Decimal(invoice.get("TotVATAmt") or "0")).quantize(Decimal("0.01")))
    except InvalidOperation:
        return ""


def verification_url(invoice: dict, environment: str = "production") -> Optional[str]:
    """Public CIS page that verifies the invoice (the URL encoded in the invoice QR code)."""
    iic = invoice.get("IIC")
    if not iic:
        return None
    seller = invoice.get("Seller") or {}
    buyer = invoice.get("Buyer") or {}
    # A self-issued invoice is issued by the buyer.
    issuer = buyer.get("IDNum") if invoice.get("TypeOfSelfIss") else seller.get("IDNum")
    host = "efiskalizimi-app.tatime.gov.al" if environment == "production" else "efiskalizimi-app-test.tatime.gov.al"
    query = urlencode({
        "iic": iic,
        "tin": issuer or "",
        "crtd": invoice.get("IssueDateTime", ""),
        "ord": invoice.get("InvOrdNum", ""),
        "bu": invoice.get("BusinUnitCode", ""),
        "cr": invoice.get("TCRCode", ""),
        "sw": invoice.get("SoftCode", ""),
        "prc": invoice.get("TotPrice", ""),
    })
    return f"https://{host}/invoice-check/#/verify?{query}"


CSV_COLUMNS = (
    "IssueDateTime", "InvNum", "TypeOfInv", "IsEinvoice", "SellerNIPT", "SellerName", "BuyerNIPT", "BuyerName",
    "Currency", "ExRate", "TotPriceWoVAT", "TotVATAmt", "TotPrice", "PayMethods", "BusinUnitCode", "TCRCode",
    "OperatorCode", "CorrectiveType", "CorrectiveIICRef", "FIC", "IIC", "EIC", "VerificationUrl",
)


def flatten_invoice(invoice: dict, environment: str = "production") -> Dict[str, str]:
    """One flat row per invoice, used for CSV export. TotPriceWoVAT is computed when CIS omits it."""
    seller = invoice.get("Seller") or {}
    buyer = invoice.get("Buyer") or {}
    currency = invoice.get("Currency") or {}
    corrective = invoice.get("CorrectiveInv") or {}
    payments = "; ".join(f"{item.get('Type', '')}:{item.get('Amt', '')}" for item in invoice.get("PayMethods") or [])
    return {
        "IssueDateTime": invoice.get("IssueDateTime", ""),
        "InvNum": invoice.get("InvNum") or invoice.get("InvOrdNum", ""),
        "TypeOfInv": invoice.get("TypeOfInv", ""),
        "IsEinvoice": invoice.get("IsEinvoice", ""),
        "SellerNIPT": seller.get("IDNum", ""),
        "SellerName": seller.get("Name", ""),
        "BuyerNIPT": buyer.get("IDNum", ""),
        "BuyerName": buyer.get("Name", ""),
        "Currency": currency.get("Code", "ALL"),
        "ExRate": currency.get("ExRate", ""),
        "TotPriceWoVAT": net_amount(invoice),
        "TotVATAmt": invoice.get("TotVATAmt", ""),
        "TotPrice": invoice.get("TotPrice", ""),
        "PayMethods": payments,
        "BusinUnitCode": invoice.get("BusinUnitCode", ""),
        "TCRCode": invoice.get("TCRCode", ""),
        "OperatorCode": invoice.get("OperatorCode", ""),
        "CorrectiveType": corrective.get("Type", ""),
        "CorrectiveIICRef": corrective.get("IICRef", ""),
        "FIC": invoice.get("FIC", ""),
        "IIC": invoice.get("IIC", ""),
        "EIC": invoice.get("EIC", ""),
        "VerificationUrl": verification_url(invoice, environment) or "",
    }
