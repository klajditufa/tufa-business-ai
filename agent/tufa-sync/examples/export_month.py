"""Export last month's sales and purchases to CSV files.

    python examples/export_month.py company.p12

The certificate password is read from CIS_CERT_PASSWORD or asked for.
"""

from __future__ import annotations

import csv
import getpass
import os
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cis_client import PURCHASES, SALES, CisClient, CisFault, flatten_invoice
from cis_client.convert import CSV_COLUMNS


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    password = os.environ.get("CIS_CERT_PASSWORD") or getpass.getpass("Certificate password: ")
    client = CisClient.from_file(sys.argv[1], password)
    last_day = date.today().replace(day=1) - timedelta(days=1)
    first_day = last_day.replace(day=1)
    for kind in (SALES, PURCHASES):
        try:
            invoices = client.fetch_all_invoices(kind, first_day, last_day)
        except CisFault as fault:
            print(f"{kind}: {fault} {fault.hint or ''}", file=sys.stderr)
            return 1
        path = Path(f"{kind.lower()}-{first_day:%Y-%m}.csv")
        with path.open("w", newline="", encoding="utf-8-sig") as handle:
            writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
            writer.writeheader()
            for invoice in sorted(invoices, key=lambda item: item.get("IssueDateTime", "")):
                writer.writerow(flatten_invoice(invoice, client.environment))
        print(f"{path}: {len(invoices)} invoices")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
