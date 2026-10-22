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

from collections.abc import Iterable
from decimal import Decimal, InvalidOperation
from urllib.parse import urlencode

from lxml import etree

from . import units
from .transport import child, local_name

# Wrapper elements whose children form a list, mapped to the child element name.
LIST_CONTAINERS: dict[str, str] = {
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
    "TypeOfInv",
    "IsSimplifiedInv",
    "IsBadDeb",
    "TypeOfSelfIss",
    "IssueDateTime",
    "SendDateTime",
    "InvNum",
    "InvOrdNum",
    "TCRCode",
    "IsIssuerInVAT",
    "TaxFreeAmt",
    "MarkUpAmt",
    "GoodsExAmt",
    "TotPriceWoVAT",
    "TotVATAmt",
    "TotPrice",
    "OperatorCode",
    "BusinUnitCode",
    "SoftCode",
    "ImpCustDecNum",
    "IIC",
    "IICSignature",
    "FIC",
    "IsReverseCharge",
    "PayDeadline",
    "IsEinvoice",
    "EIC",
    "PayMethods",
    "Seller",
    "Buyer",
    "Currency",
    "SupplyDateOrPeriod",
    "CorrectiveInv",
    "BadDebtInv",
    "SameTaxes",
    "Fees",
    "SumInvIICRefs",
    "Items",
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


def invoices_from_response(response: etree._Element) -> tuple[list[dict], int]:
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


def taxpayers_from_response(response: etree._Element) -> list[dict]:
    container = child(response, "Taxpayers")
    if container is None:
        return []
    keys = ("Tin", "Name", "Address", "Town", "Country")
    return [{key: node.get(key, "") for key in keys} for node in container if local_name(node) == "Taxpayer"]


def operators_from_response(response: etree._Element) -> list[dict]:
    """Operators as ``{"name", "opCode", ...}``; ``opCode`` is the OperatorCode used when fiscalizing."""
    container = child(response, "Operators")
    if container is None:
        return []
    result = []
    for node in container:
        if local_name(node) != "Operator":
            continue
        first, last = node.get("OprFirstName", ""), node.get("OprLastName", "")
        result.append(
            {
                "name": " ".join(part for part in (first, last) if part),
                "opCode": node.get("OprCode", ""),
                "firstName": first,
                "lastName": last,
                "idNumber": node.get("OprID", ""),
                "validFrom": node.get("OprValidFrom"),
                "validTo": node.get("OprValidTo"),
            }
        )
    return result


def list_from_response(response: etree._Element, container_name: str, item_name: str) -> list[dict]:
    """Generic list of attribute dicts, used for business units and TCRs."""
    container = child(response, container_name)
    if container is None:
        return []
    return [dict(node.attrib) for node in container if local_name(node) == item_name]


def _decimal(value: str | None) -> Decimal:
    try:
        return Decimal(value or "0")
    except InvalidOperation:
        return Decimal(0)


def net_amount(invoice: dict) -> str:
    """TotPriceWoVAT, or TotPrice - TotVATAmt when CIS leaves it out (date range lists do)."""
    if invoice.get("TotPriceWoVAT"):
        return invoice["TotPriceWoVAT"]
    try:
        return str(
            (Decimal(invoice.get("TotPrice") or "0") - Decimal(invoice.get("TotVATAmt") or "0")).quantize(
                Decimal("0.01")
            )
        )
    except InvalidOperation:
        return ""


def totals(invoices: Iterable[dict]) -> dict[str, str]:
    """Number of invoices and their summed net, VAT and total amounts (as "1234.56")."""
    count, net, vat, total = 0, Decimal(0), Decimal(0), Decimal(0)
    for invoice in invoices:
        count += 1
        net += _decimal(net_amount(invoice))
        vat += _decimal(invoice.get("TotVATAmt"))
        total += _decimal(invoice.get("TotPrice"))
    return {"count": str(count), "net": f"{net:.2f}", "vat": f"{vat:.2f}", "total": f"{total:.2f}"}


def verification_url(invoice: dict, environment: str = "production") -> str | None:
    """Public CIS page that verifies the invoice (the URL encoded in the invoice QR code)."""
    iic = invoice.get("IIC")
    if not iic:
        return None
    seller = invoice.get("Seller") or {}
    buyer = invoice.get("Buyer") or {}
    # A self-issued invoice is issued by the buyer.
    issuer = buyer.get("IDNum") if invoice.get("TypeOfSelfIss") else seller.get("IDNum")
    host = "efiskalizimi-app.tatime.gov.al" if environment == "production" else "efiskalizimi-app-test.tatime.gov.al"
    query = urlencode(
        {
            "iic": iic,
            "tin": issuer or "",
            "crtd": invoice.get("IssueDateTime", ""),
            "ord": invoice.get("InvOrdNum", ""),
            "bu": invoice.get("BusinUnitCode", ""),
            "cr": invoice.get("TCRCode", ""),
            "sw": invoice.get("SoftCode", ""),
            "prc": invoice.get("TotPrice", ""),
        }
    )
    return f"https://{host}/invoice-check/#/verify?{query}"


CSV_COLUMNS = (
    "IssueDateTime",
    "InvNum",
    "TypeOfInv",
    "IsEinvoice",
    "SellerNIPT",
    "SellerName",
    "BuyerNIPT",
    "BuyerName",
    "Currency",
    "ExRate",
    "TotPriceWoVAT",
    "TotVATAmt",
    "TotPrice",
    "PayMethods",
    "BusinUnitCode",
    "TCRCode",
    "OperatorCode",
    "CorrectiveType",
    "CorrectiveIICRef",
    "FIC",
    "IIC",
    "EIC",
    "VerificationUrl",
)


def flatten_invoice(invoice: dict, environment: str = "production") -> dict[str, str]:
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


# Item lines ------------------------------------------------------------------
#
# Date range lists come without items; these helpers need complete invoices,
# as returned by a FIC lookup (CisClient.get_invoice / get_invoice_details).

ITEM_CSV_COLUMNS = (
    "IssueDateTime",
    "InvNum",
    "TypeOfInv",
    "SellerNIPT",
    "SellerName",
    "BuyerNIPT",
    "BuyerName",
    "Currency",
    "ExRate",
    "ItemName",
    "ItemCode",
    "Unit",
    "UnitCode",
    "Quantity",
    "UnitPriceWoVAT",
    "UnitPriceWithVAT",
    "RebatePercent",
    "VATRate",
    "PriceWoVAT",
    "VATAmt",
    "Price",
    "ExemptFromVAT",
    "Investment",
    "FIC",
)

# CIS item attribute behind each item column.
_ITEM_ATTRIBUTES = (
    ("ItemName", "N"),
    ("ItemCode", "C"),
    ("Unit", "U"),
    ("Quantity", "Q"),
    ("UnitPriceWoVAT", "UPB"),
    ("UnitPriceWithVAT", "UPA"),
    ("RebatePercent", "R"),
    ("VATRate", "VR"),
    ("PriceWoVAT", "PB"),
    ("VATAmt", "VA"),
    ("Price", "PA"),
    ("ExemptFromVAT", "EX"),
    ("Investment", "IN"),
)


def flatten_items(invoice: dict) -> list[dict[str, str]]:
    """One flat row per invoice line, with the invoice's date, number and parties; used for CSV export.

    Unit is the text the issuer wrote; UnitCode is its standard code (KGM, XPP, ...) when it is recognised.
    """
    head = flatten_invoice(invoice)
    common = {key: head[key] for key in ITEM_CSV_COLUMNS if key in head}
    rows = []
    for item in invoice.get("Items") or []:
        row = {**common, **{column: item.get(attribute, "") for column, attribute in _ITEM_ATTRIBUTES}}
        row["UnitCode"] = units.unit(item.get("U", "")).code
        rows.append(row)
    return rows


ITEM_SUMMARY_COLUMNS = (
    "ItemCode",
    "ItemName",
    "Unit",
    "UnitCode",
    "Quantity",
    "PriceWoVAT",
    "VATAmt",
    "Price",
    "Invoices",
)


def item_key(item: dict) -> tuple[str, str]:
    """Lines with the same name (ignoring case and accents) and the same unit are the same item."""
    return units.name_key(item.get("N", "")), units.unit(item.get("U", "")).key


def summarise_items(invoices: Iterable[dict]) -> list[dict[str, str]]:
    """Invoice lines grouped by item, largest total first.

    Item codes differ between issuers, so lines are grouped by name and unit
    (see item_key); the codes seen are listed in ItemCode. Corrective invoices
    carry negative lines, so they reduce the totals of the items they correct.
    """
    groups: dict[tuple[str, str], dict] = {}
    for invoice in invoices:
        for item in invoice.get("Items") or []:
            unit = units.unit(item.get("U", ""))
            group = groups.setdefault(
                item_key(item),
                {
                    "ItemName": (item.get("N") or "").strip(),
                    "Unit": unit.label,
                    "UnitCode": unit.code,
                    "codes": {},
                    "Quantity": Decimal(0),
                    "PriceWoVAT": Decimal(0),
                    "VATAmt": Decimal(0),
                    "Price": Decimal(0),
                    "invoices": set(),
                },
            )
            code = (item.get("C") or "").strip()
            if code:
                group["codes"].setdefault(units.fold(code), code)
            for column, attribute in (("Quantity", "Q"), ("PriceWoVAT", "PB"), ("VATAmt", "VA"), ("Price", "PA")):
                group[column] += _decimal(item.get(attribute))
            group["invoices"].add(invoice.get("FIC") or invoice.get("IIC") or id(invoice))
    ordered = sorted(groups.values(), key=lambda group: (-group["Price"], group["ItemName"].lower()))
    return [
        {
            "ItemCode": " / ".join(group["codes"].values()),
            "ItemName": group["ItemName"],
            "Unit": group["Unit"],
            "UnitCode": group["UnitCode"],
            "Quantity": format(group["Quantity"].normalize(), "f"),
            "PriceWoVAT": f"{group['PriceWoVAT']:.2f}",
            "VATAmt": f"{group['VATAmt']:.2f}",
            "Price": f"{group['Price']:.2f}",
            "Invoices": str(len(group["invoices"])),
        }
        for group in ordered
    ]
