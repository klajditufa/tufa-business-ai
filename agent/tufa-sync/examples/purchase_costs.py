"""Purchase costs for a period, per supplier and per item.

    python examples/purchase_costs.py company.p12 2026-09-01 2026-09-30

Writes costs_by_supplier.csv and costs_by_item.csv. The certificate password is
read from CIS_CERT_PASSWORD or asked for. Items need one CIS lookup per invoice,
done a few at a time; a month of purchases usually takes seconds.
"""

from __future__ import annotations

import csv
import getpass
import os
import sys
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cis_client import PURCHASES, CisClient, CisFault, summarise_items
from cis_client.convert import ITEM_SUMMARY_COLUMNS, net_amount


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__)
        return 2
    path, start, end = sys.argv[1:]
    password = os.environ.get("CIS_CERT_PASSWORD")
    if password is None:
        password = getpass.getpass("Certificate password (Enter if none): ")
    client = CisClient.from_file(path, password)

    try:
        invoices = client.fetch_all_invoices(PURCHASES, start, end)
        complete = client.get_invoice_details(
            invoices,
            PURCHASES,
            lambda done, total: print(f"\rItems: {done} of {total} invoices", end="", file=sys.stderr),
        )
    except CisFault as fault:
        print(f"\nCIS: {fault} {fault.hint or ''}", file=sys.stderr)
        return 1
    print(file=sys.stderr)

    suppliers: dict[str, dict] = defaultdict(
        lambda: {"Invoices": 0, "Net": Decimal(0), "VAT": Decimal(0), "Total": Decimal(0)}
    )
    for invoice in complete:
        seller = invoice.get("Seller") or {}
        row = suppliers[seller.get("IDNum", "")]
        row["Name"] = seller.get("Name", "")
        row["Invoices"] += 1
        row["Net"] += Decimal(net_amount(invoice) or "0")
        row["VAT"] += Decimal(invoice.get("TotVATAmt") or "0")
        row["Total"] += Decimal(invoice.get("TotPrice") or "0")

    with open("costs_by_supplier.csv", "w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.writer(handle)
        writer.writerow(["NIPT", "Name", "Invoices", "Net", "VAT", "Total"])
        for nipt, row in sorted(suppliers.items(), key=lambda entry: -entry[1]["Total"]):
            writer.writerow(
                [nipt, row["Name"], row["Invoices"], f"{row['Net']:.2f}", f"{row['VAT']:.2f}", f"{row['Total']:.2f}"]
            )

    with open("costs_by_item.csv", "w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=ITEM_SUMMARY_COLUMNS)
        writer.writeheader()
        writer.writerows(summarise_items(complete))

    print(f"{len(complete)} invoices from {len(suppliers)} suppliers: costs_by_supplier.csv, costs_by_item.csv")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
