"""Command line interface.

Run without arguments to start the web app. Other commands print data from
CIS as a table, JSON or CSV; see ``cis-client --help``.

The certificate password is read from the CIS_CERT_PASSWORD environment
variable or asked for interactively; it is never taken as an argument so it
does not end up in the shell history.
"""

from __future__ import annotations

import argparse
import csv
import getpass
import io
import json
import logging
import os
import re
import shutil
import sys
from collections.abc import Collection, Sequence
from datetime import date
from pathlib import Path
from typing import Callable

from . import __version__, convert, units
from .certificate import Certificate
from .client import PURCHASES, SALES, CisClient
from .errors import CertificateError, CisClientError, CisFault, ValidationError
from .server import Businesses, serve

Column = tuple[str, Callable[[dict], str]]


def _password_prompt_allowed() -> bool:
    return sys.stdin.isatty()


def load_certificate(path: str) -> Certificate:
    password = os.environ.get("CIS_CERT_PASSWORD")
    try:
        return Certificate.from_file(path, password)
    except CertificateError:
        if password is not None or not _password_prompt_allowed():
            raise
    return Certificate.from_file(path, getpass.getpass("Certificate password: "))


def _client(args: argparse.Namespace) -> CisClient:
    if not args.cert:
        raise ValidationError("Pass --cert FILE or set the CIS_CERT environment variable", "cert")
    return CisClient(load_certificate(args.cert), args.env, timeout=args.timeout)


# Output ----------------------------------------------------------------------


MAX_CELL = 42  # longest value shown in a table cell
MIN_FLEXIBLE = 16  # flexible columns are not shortened below this
NUMBER = re.compile(r"^-?[\d,]+(\.\d+)?$")


def _truncate(value: str, width: int) -> str:
    return value if len(value) <= width else value[: width - 1] + "…"


def render_table(
    rows: Sequence[dict],
    columns: Sequence[Column],
    max_width: int | None = None,
    flexible: Collection[str] = (),
    optional: Sequence[str] = (),
) -> str:
    """A plain text table; columns holding only numbers are right aligned.

    With ``max_width`` (the terminal width) lines are kept from wrapping: the
    ``optional`` columns are left out, in the order given, while the line would
    not fit even with the ``flexible`` columns shortened; then the flexible
    columns are shortened as needed.
    """
    if not rows:
        return "(no results)\n"
    headers = [header for header, _ in columns]
    cells = [[str(getter(row) or "") for _, getter in columns] for row in rows]
    widths = [
        min(MAX_CELL, max(len(header), *(len(line[index]) for line in cells))) for index, header in enumerate(headers)
    ]
    numeric = [all(NUMBER.match(line[index]) for line in cells if line[index]) for index in range(len(columns))]
    shown = list(range(len(columns)))
    hidden: list[str] = []

    def line_width(shortest: bool = False) -> int:
        return sum(
            min(widths[index], MIN_FLEXIBLE) if shortest and headers[index] in flexible else widths[index]
            for index in shown
        ) + 2 * (len(shown) - 1)

    if max_width:
        for header in optional:
            if line_width(shortest=True) <= max_width:
                break
            shown.remove(headers.index(header))
            hidden.append(header)
        while line_width() > max_width:
            candidates = [index for index in shown if headers[index] in flexible and widths[index] > MIN_FLEXIBLE]
            if not candidates:
                break
            widths[max(candidates, key=lambda index: widths[index])] -= 1

    def format_line(values: Sequence[str]) -> str:
        parts = []
        for index in shown:
            value = _truncate(values[index], widths[index])
            parts.append(value.rjust(widths[index]) if numeric[index] else value.ljust(widths[index]))
        return "  ".join(parts).rstrip()

    lines = [format_line(headers), "  ".join("-" * widths[index] for index in shown)]
    lines.extend(format_line(line) for line in cells)
    if hidden:
        lines.append(f"({', '.join(hidden)} left out to fit the window; --format csv or json has every field)")
    return "\n".join(lines) + "\n"


def _terminal_width(args: argparse.Namespace) -> int | None:
    """Width to fit tables to, when they are shown in a terminal."""
    if args.output or not sys.stdout.isatty():
        return None
    return shutil.get_terminal_size().columns


def _csv_cell(value: object) -> str:
    text = "" if value is None else str(value)
    # Keep spreadsheet apps from evaluating text that looks like a formula.
    if text[:1] in ("=", "+", "-", "@", "\t", "\r"):
        try:
            float(text)
        except ValueError:
            return "'" + text
    return text


def render_csv(rows: Sequence[dict], fields: Sequence[str]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(fields), extrasaction="ignore", lineterminator="\n")
    writer.writeheader()
    writer.writerows({key: _csv_cell(value) for key, value in row.items()} for row in rows)
    return buffer.getvalue()


def emit(text: str, output: str | None, csv_output: bool = False) -> None:
    if output:
        # The BOM lets Excel detect UTF-8 (names often contain ë and ç).
        Path(output).expanduser().write_text(text, encoding="utf-8-sig" if csv_output else "utf-8")
        print(f"Saved {output}", file=sys.stderr)
    else:
        sys.stdout.write(text)


def _amount(value: str | None) -> str:
    try:
        return f"{float(value or 0):,.2f}"
    except ValueError:
        return value or ""


def _invoice_columns(kind: str) -> list[Column]:
    party = "Buyer" if kind == SALES else "Seller"
    return [
        ("Issued", lambda row: (row.get("IssueDateTime") or "")[:16].replace("T", " ")),
        ("Number", lambda row: row.get("InvNum") or row.get("InvOrdNum") or ""),
        ("Type", lambda row: row.get("TypeOfInv", "") + (" E" if row.get("IsEinvoice") == "true" else "")),
        (f"{party} NIPT", lambda row: (row.get(party) or {}).get("IDNum", "")),
        (party, lambda row: (row.get(party) or {}).get("Name", "")),
        ("Net", lambda row: _amount(convert.net_amount(row))),
        ("VAT", lambda row: _amount(row.get("TotVATAmt"))),
        ("Total", lambda row: _amount(row.get("TotPrice"))),
        ("FIC", lambda row: row.get("FIC", "")),
    ]


def _item_columns(kind: str) -> list[Column]:
    party = "Buyer" if kind == SALES else "Seller"
    return [
        ("Issued", lambda row: (row["invoice"].get("IssueDateTime") or "")[:10]),
        ("Number", lambda row: row["invoice"].get("InvOrdNum") or row["invoice"].get("InvNum") or ""),
        (party, lambda row: (row["invoice"].get(party) or {}).get("Name", "")),
        ("Item", lambda row: row["item"].get("N", "")),
        ("Qty", lambda row: row["item"].get("Q", "")),
        ("Unit", lambda row: units.unit(row["item"].get("U", "")).label),
        ("VAT %", lambda row: row["item"].get("VR", "")),
        ("Net", lambda row: _amount(row["item"].get("PB"))),
        ("VAT", lambda row: _amount(row["item"].get("VA"))),
        ("Total", lambda row: _amount(row["item"].get("PA"))),
    ]


SUMMARY_COLUMNS: list[Column] = [
    ("Code", lambda row: row["ItemCode"]),
    ("Item", lambda row: row["ItemName"]),
    ("Unit", lambda row: row["Unit"]),
    ("Qty", lambda row: row["Quantity"]),
    ("Net", lambda row: _amount(row["PriceWoVAT"])),
    ("VAT", lambda row: _amount(row["VATAmt"])),
    ("Total", lambda row: _amount(row["Price"])),
    ("Invoices", lambda row: row["Invoices"]),
]


# Commands ----------------------------------------------------------------------


def command_serve(args: argparse.Namespace) -> int:
    businesses = Businesses(timeout=args.timeout)
    if args.cert:
        business = businesses.add(load_certificate(args.cert), args.env)
        certificate = business.summary()["certificate"]
        name = certificate.get("name") or certificate.get("commonName")
        print(
            f"Certificate loaded: {name} ({certificate.get('nipt') or 'NIPT unknown'}), {business.client.environment}"
        )
        if business.warning:
            print(f"Warning: {business.warning}", file=sys.stderr)
    serve(businesses, port=args.port, open_browser=not args.no_browser)
    return 0


def command_info(args: argparse.Namespace) -> int:
    certificate = load_certificate(args.cert) if args.cert else None
    if certificate is None:
        raise ValidationError("Pass --cert FILE or set the CIS_CERT environment variable", "cert")
    summary = certificate.summary()
    if args.check:
        business = Businesses(timeout=args.timeout).connect(certificate, args.env)
        summary = {
            **business.summary()["certificate"],
            "environment": business.client.environment,
            "acceptedByCis": business.verified,
        }
        if business.warning:
            summary["warning"] = business.warning
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


def command_invoices(args: argparse.Namespace, kind: str) -> int:
    client = _client(args)
    environment = client.environment
    if args.fic:
        invoice = client.get_invoice(args.fic, kind)
        if invoice is None:
            print("No invoice with this FIC.", file=sys.stderr)
            return 1
        emit(json.dumps(invoice, indent=2, ensure_ascii=False) + "\n", args.output)
        return 0

    if args.all:

        def progress(fetched: int, total: int, start: date, end: date) -> None:
            print(f"\rFetched {fetched} invoices ({start} to {end}: {total})", end="", file=sys.stderr, flush=True)

        rows = client.fetch_all_invoices(kind, args.date_from, args.date_to, progress)
        print(file=sys.stderr)
        total = len(rows)
    else:
        page = client.get_invoices(kind, args.date_from, args.date_to, args.page)
        rows, total = page.invoices, page.count
        if page.has_more:
            print(
                f"Page {page.page} of {page.pages} ({total} invoices). Use --page or --all for the rest.",
                file=sys.stderr,
            )

    rows = sorted(rows, key=lambda row: row.get("IssueDateTime") or "")  # CIS returns them unordered
    width = _terminal_width(args)
    if args.items or args.by_item:
        return _emit_items(args, client, kind, rows, width)
    if args.format == "json":
        emit(json.dumps(rows, indent=2, ensure_ascii=False) + "\n", args.output)
    elif args.format == "csv":
        flat = [convert.flatten_invoice(row, environment) for row in rows]
        emit(render_csv(flat, convert.CSV_COLUMNS), args.output, csv_output=True)
    else:
        party = "Buyer" if kind == SALES else "Seller"
        emit(render_table(rows, _invoice_columns(kind), width, flexible={party}, optional=["FIC"]), args.output)
        print(f"{len(rows)} shown, {total} in total", file=sys.stderr)
    return 0


def _emit_items(args: argparse.Namespace, client: CisClient, kind: str, rows: list[dict], width: int | None) -> int:
    """--items (every invoice line) and --by-item (totals per item); both need every invoice looked up by FIC."""
    shown_progress = False

    def progress(done: int, total: int) -> None:
        nonlocal shown_progress
        shown_progress = True
        print(f"\rLooking up items: {done} of {total} invoices", end="", file=sys.stderr, flush=True)

    invoices = client.get_invoice_details(rows, kind, progress)
    if shown_progress:
        print(file=sys.stderr)
    party = "Buyer" if kind == SALES else "Seller"
    if args.by_item:
        summary = convert.summarise_items(invoices)
        if args.format == "json":
            emit(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", args.output)
        elif args.format == "csv":
            emit(render_csv(summary, convert.ITEM_SUMMARY_COLUMNS), args.output, csv_output=True)
        else:
            emit(render_table(summary, SUMMARY_COLUMNS, width, flexible={"Item"}), args.output)
        print(f"{len(summary)} items in {len(invoices)} invoices", file=sys.stderr)
    elif args.format == "json":
        emit(json.dumps(invoices, indent=2, ensure_ascii=False) + "\n", args.output)  # complete invoices
    elif args.format == "csv":
        lines = [line for invoice in invoices for line in convert.flatten_items(invoice)]
        emit(render_csv(lines, convert.ITEM_CSV_COLUMNS), args.output, csv_output=True)
    else:
        lines = [{"invoice": invoice, "item": item} for invoice in invoices for item in invoice.get("Items") or []]
        emit(
            render_table(lines, _item_columns(kind), width, flexible={party, "Item"}, optional=["VAT %", "Unit"]),
            args.output,
        )
        print(f"{len(lines)} lines in {len(invoices)} invoices", file=sys.stderr)
    return 0


def _emit_list(
    args: argparse.Namespace, rows: list[dict], columns: list[Column], flexible: Collection[str] = ()
) -> int:
    if args.format == "json":
        emit(json.dumps(rows, indent=2, ensure_ascii=False) + "\n", args.output)
    elif args.format == "csv":
        fields = list(dict.fromkeys(key for row in rows for key in row))
        emit(render_csv(rows, fields), args.output, csv_output=True)
    else:
        emit(render_table(rows, columns, _terminal_width(args), flexible), args.output)
    return 0


def _get(key: str) -> Callable[[dict], str]:
    return lambda row: row.get(key) or ""


def command_taxpayers(args: argparse.Namespace) -> int:
    rows = _client(args).get_taxpayers(" ".join(args.term))
    columns = [
        ("NIPT", _get("Tin")),
        ("Name", _get("Name")),
        ("Address", _get("Address")),
        ("Town", _get("Town")),
        ("Country", _get("Country")),
    ]
    return _emit_list(args, rows, columns, flexible={"Name", "Address"})


def command_operators(args: argparse.Namespace) -> int:
    rows = _client(args).get_operators()
    columns = [
        ("Name", _get("name")),
        ("Operator code", _get("opCode")),
        ("ID", _get("idNumber")),
        ("Valid from", _get("validFrom")),
        ("Valid to", _get("validTo")),
    ]
    return _emit_list(args, rows, columns)


def command_business_units(args: argparse.Namespace) -> int:
    rows = _client(args).get_business_units()
    columns = [
        ("Code", _get("BUCode")),
        ("Name", _get("BUName")),
        ("Address", _get("BUStreetName")),
        ("Valid from", _get("BUValidFrom")),
        ("Valid to", _get("BUValidTo")),
    ]
    return _emit_list(args, rows, columns)


def command_tcrs(args: argparse.Namespace) -> int:
    rows = _client(args).get_tcrs()
    columns = [
        ("TCR code", _get("TCRCode")),
        ("Internal ID", _get("TCRIntID")),
        ("Business unit", _get("BusinUnitCode")),
        ("Type", _get("Type")),
        ("Valid from", _get("ValidFrom")),
        ("Valid to", _get("ValidTo")),
    ]
    return _emit_list(args, rows, columns)


def command_pdf(args: argparse.Namespace) -> int:
    document = _client(args).get_einvoice_pdf(args.eic, args.party)
    if document is None:
        print("CIS has no PDF for this EIC.", file=sys.stderr)
        return 1
    output = Path(args.output or f"{document.eic}.pdf").expanduser()
    output.write_bytes(document.pdf)
    print(f"Saved {output}", file=sys.stderr)
    return 0


def command_push(args: argparse.Namespace) -> int:
    """Read SALES and/or PURCHASES from CIS and send them to TUFA Business AI.

    With --details every invoice is fetched complete (items and VAT per rate), so TUFA
    splits VAT by rate exactly; this takes one extra CIS call per invoice.
    """
    from .tufa import TufaClient

    url = args.tufa_url or os.environ.get("TUFA_URL")
    key = args.tufa_key or os.environ.get("TUFA_API_KEY")
    if not url:
        raise ValidationError("Pass --tufa-url URL or set TUFA_URL", "tufa_url")
    if not key:
        raise ValidationError("Set TUFA_API_KEY (create the key in TUFA under Settings → Sinkronizimi)", "tufa_key")
    tufa = TufaClient(url, key, timeout=args.timeout)
    company = tufa.check().get("company") or {}
    print(
        f"TUFA: key accepted for {company.get('legal_name') or company.get('id')} ({company.get('nipt') or 'NIPT?'})",
        file=sys.stderr,
    )

    client = _client(args)
    if client.certificate.nipt and company.get("nipt") and client.certificate.nipt != str(company["nipt"]).upper():
        raise ValidationError(
            f"Certificate NIPT {client.certificate.nipt} does not match the TUFA company NIPT {company['nipt']}. "
            "Use the API key of the right company.",
            "cert",
        )

    kinds = [SALES, PURCHASES] if args.what == "all" else [SALES if args.what == "sales" else PURCHASES]
    summary = []
    failed = False
    for kind in kinds:

        def progress(fetched: int, total: int, start: date, end: date, kind=kind) -> None:
            print(
                f"\r{kind.lower()}: fetched {fetched} ({start} to {end}: {total})", end="", file=sys.stderr, flush=True
            )

        rows = client.fetch_all_invoices(kind, args.date_from, args.date_to, progress)
        print(file=sys.stderr)
        if args.details and rows:

            def detail_progress(done: int, total: int, kind=kind) -> None:
                print(f"\r{kind.lower()}: details {done}/{total}", end="", file=sys.stderr, flush=True)

            rows = client.get_invoice_details(rows, kind, detail_progress)
            print(file=sys.stderr)
        label = f"CIS {kind.lower()} {args.date_from or ''}..{args.date_to or ''}".strip()
        result = tufa.push(
            kind,
            rows,
            label=label,
            progress=lambda done, total, kind=kind: print(
                f"\r{kind.lower()}: sent {done}/{total}", end="", file=sys.stderr, flush=True
            ),
        )
        if rows:
            print(file=sys.stderr)
        print(
            f"{kind.lower()}: {result.sent} read from CIS → {result.imported} new, "
            f"{result.updated} updated, {result.skipped} skipped",
            file=sys.stderr,
        )
        for item in result.errors[:20]:
            print(f"  ! {item.get('fic') or '-'}: {item.get('message')}", file=sys.stderr)
        failed = failed or (result.skipped > 0 and result.imported + result.updated == 0 and result.sent > 0)
        summary.append(result.as_dict())
    if args.format == "json":
        emit(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", args.output)
    return 1 if failed else 0


# Parser ------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument(
        "--cert",
        default=os.environ.get("CIS_CERT"),
        metavar="FILE",
        help="fiscalization certificate (.p12/.pfx or PEM); default: $CIS_CERT",
    )
    common.add_argument(
        "--env",
        choices=("production", "test"),
        default=os.environ.get("CIS_ENV") or None,
        help="CIS environment; default: $CIS_ENV, otherwise guessed from the certificate issuer",
    )
    common.add_argument("--timeout", type=float, default=60.0, help="seconds to wait for CIS (default 60)")

    output = argparse.ArgumentParser(add_help=False)
    output.add_argument("--format", choices=("table", "json", "csv"), default="table")
    output.add_argument("-o", "--output", metavar="FILE", help="write to FILE instead of the terminal")

    parser = argparse.ArgumentParser(
        prog="cis-client",
        description="Read sales, purchases, taxpayers and operators from the Albanian fiscalization system (CIS).",
        epilog=(
            "Without a command the web app starts. The certificate password comes from $CIS_CERT_PASSWORD or a prompt."
        ),
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument("--debug", action="store_true", help="log the SOAP messages exchanged with CIS")
    commands = parser.add_subparsers(dest="command", metavar="COMMAND")

    serve_parser = commands.add_parser("serve", parents=[common], help="start the web app (default)")
    serve_parser.add_argument("--port", type=int, default=8765)
    serve_parser.add_argument("--no-browser", action="store_true", help="do not open the browser")
    serve_parser.set_defaults(handler=command_serve)

    info = commands.add_parser("info", parents=[common], help="show certificate details")
    info.add_argument("--check", action="store_true", help="also confirm that CIS accepts the certificate")
    info.set_defaults(handler=command_info)

    for name, kind, label in (("sales", SALES, "sales invoices"), ("purchases", PURCHASES, "purchase invoices")):
        sub = commands.add_parser(name, parents=[common, output], help=f"list {label} registered in CIS")
        sub.add_argument(
            "--from", dest="date_from", metavar="YYYY-MM-DD", help="first day (default: first day of this month)"
        )
        sub.add_argument(
            "--to", dest="date_to", metavar="YYYY-MM-DD", help="last day (default: last day of this month)"
        )
        sub.add_argument("--page", type=int, default=1, help="page of 1000 invoices (default 1)")
        sub.add_argument("--all", action="store_true", help="fetch every page")
        sub.add_argument("--fic", help="one complete invoice, with items, by FIC (printed as JSON)")
        lines = sub.add_mutually_exclusive_group()
        lines.add_argument(
            "--items",
            action="store_true",
            help="one row per invoice line; looks up every invoice in CIS, a few at a time",
        )
        lines.add_argument(
            "--by-item",
            action="store_true",
            help="totals per item (quantity, amounts, number of invoices); looks up every invoice too",
        )
        sub.set_defaults(handler=lambda args, kind=kind: command_invoices(args, kind))

    taxpayers = commands.add_parser("taxpayers", parents=[common, output], help="search taxpayers by NIPT or name")
    taxpayers.add_argument("term", nargs="+", help="NIPT or at least 3 characters of the name")
    taxpayers.set_defaults(handler=command_taxpayers)

    for name, handler, label in (
        ("operators", command_operators, "operators and their operator codes"),
        ("business-units", command_business_units, "business units (premises)"),
        ("tcrs", command_tcrs, "registered cash registers / devices (TCRs)"),
    ):
        commands.add_parser(name, parents=[common, output], help=f"list {label}").set_defaults(handler=handler)

    push = commands.add_parser(
        "push", parents=[common, output], help="read invoices from CIS and send them to TUFA Business AI"
    )
    push.add_argument(
        "what", nargs="?", choices=("all", "sales", "purchases"), default="all", help="which invoices (default: all)"
    )
    push.add_argument(
        "--from", dest="date_from", metavar="YYYY-MM-DD", help="first day (default: first day of this month)"
    )
    push.add_argument("--to", dest="date_to", metavar="YYYY-MM-DD", help="last day (default: last day of this month)")
    push.add_argument(
        "--details",
        action="store_true",
        help="send complete invoices (items, VAT per rate); one extra CIS call per invoice",
    )
    push.add_argument("--tufa-url", default=None, metavar="URL", help="TUFA address; default: $TUFA_URL")
    push.add_argument(
        "--tufa-key",
        default=None,
        metavar="KEY",
        help="API key (prefer $TUFA_API_KEY so it does not show in the shell history)",
    )
    push.set_defaults(handler=command_push)

    pdf = commands.add_parser("pdf", parents=[common], help="download the official PDF of an e-invoice")
    pdf.add_argument("eic", help="EIC of the electronic invoice")
    pdf.add_argument(
        "--party", choices=("BUYER", "SELLER"), default="BUYER", help="BUYER for purchases (default), SELLER for sales"
    )
    pdf.add_argument("-o", "--output", metavar="FILE", help="default: <EIC>.pdf")
    pdf.set_defaults(handler=command_pdf)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    arguments = list(sys.argv[1:] if argv is None else argv)
    args = parser.parse_args(arguments)
    if args.command is None:
        args = parser.parse_args([*arguments, "serve"])
    logging.basicConfig(
        level=logging.DEBUG if args.debug else logging.WARNING, format="%(levelname)s %(name)s: %(message)s"
    )
    try:
        return args.handler(args)
    except CisFault as fault:
        print(f"CIS error: {fault}", file=sys.stderr)
        if fault.hint:
            print(f"Hint: {fault.hint}", file=sys.stderr)
        return 1
    except CisClientError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        return 130
