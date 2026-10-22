// Filtering and sorting of a fetched period; plain functions so the view stays declarative.
import type { Sort } from "../../components/DataTable";
import { counterparty, netAmount } from "../../lib/invoice";
import type { ItemSummary, Line } from "../../lib/items";
import type { Invoice, Item, Kind } from "../../types";

export type TypeFilter = "all" | "CASH" | "NONCASH" | "einvoice" | "corrective";
export const TYPE_FILTERS: TypeFilter[] = ["all", "CASH", "NONCASH", "einvoice", "corrective"];

export function matchesType(invoice: Invoice, type: TypeFilter): boolean {
  if (type === "all") return true;
  if (type === "einvoice") return invoice.IsEinvoice === "true" || Boolean(invoice.EIC);
  if (type === "corrective") return Boolean(invoice.CorrectiveInv);
  return invoice.TypeOfInv === type;
}

const includes = (needle: string) => (value: string | undefined) =>
  Boolean(value && value.toLowerCase().includes(needle));

/** `needle` is lower case; it matches numbers, the other party's name or NIPT, and fiscal codes. */
export function matchesInvoice(invoice: Invoice, needle: string, kind: Kind): boolean {
  const party = counterparty(invoice, kind);
  return [
    invoice.InvNum,
    invoice.InvOrdNum,
    party.Name,
    party.IDNum,
    invoice.FIC,
    invoice.IIC,
    invoice.EIC,
    invoice.TCRCode,
    invoice.OperatorCode,
    invoice.BusinUnitCode,
  ].some(includes(needle));
}

const matchesItem = (item: Item, needle: string) => [item.N, item.C].some(includes(needle));

/** Keys are computed once per row: a period can hold tens of thousands of invoices. */
function sortBy<T>(rows: T[], read: (row: T) => string | number, dir: 1 | -1): T[] {
  return rows
    .map((row) => [read(row), row] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0) * dir)
    .map(([, row]) => row);
}

export function filterInvoices(
  invoices: Invoice[],
  type: TypeFilter,
  needle: string,
  kind: Kind,
  sort: Sort,
): Invoice[] {
  const rows = invoices.filter(
    (invoice) => matchesType(invoice, type) && (!needle || matchesInvoice(invoice, needle, kind)),
  );
  const read =
    {
      date: (invoice: Invoice) => Date.parse(invoice.IssueDateTime || "") || 0,
      number: (invoice: Invoice) => Number(invoice.InvOrdNum) || 0,
      party: (invoice: Invoice) => (counterparty(invoice, kind).Name || "").toLowerCase(),
      net: (invoice: Invoice) => Number(netAmount(invoice)) || 0,
      vat: (invoice: Invoice) => Number(invoice.TotVATAmt) || 0,
      total: (invoice: Invoice) => Number(invoice.TotPrice) || 0,
    }[sort.key] ?? ((invoice: Invoice) => invoice.IssueDateTime || "");
  return sortBy(rows, read, sort.dir);
}

/**
 * The lines of the period's invoices whose items are loaded. The filter text keeps whole
 * invoices it matches, and single lines whose item name or code it matches.
 */
export function filterLines(
  invoices: Invoice[],
  details: ReadonlyMap<string, Invoice>,
  type: TypeFilter,
  needle: string,
  kind: Kind,
): Line[] {
  const lines: Line[] = [];
  for (const listed of invoices) {
    const invoice = listed.FIC ? details.get(listed.FIC) : undefined;
    if (!invoice?.Items || !matchesType(invoice, type)) continue;
    const whole = !needle || matchesInvoice(invoice, needle, kind);
    for (const item of invoice.Items) if (whole || matchesItem(item, needle)) lines.push({ invoice, item });
  }
  return lines;
}

/** The invoices the lines come from, oldest first. */
export function invoicesOf(lines: Line[]): Invoice[] {
  const unique = [...new Set(lines.map(({ invoice }) => invoice))];
  return unique.sort(
    (a, b) => (Date.parse(a.IssueDateTime || "") || 0) - (Date.parse(b.IssueDateTime || "") || 0),
  );
}

export function sortSummary(rows: ItemSummary[], sort: Sort): ItemSummary[] {
  const read =
    {
      name: (row: ItemSummary) => row.ItemName.toLowerCase(),
      qty: (row: ItemSummary) => Number(row.Quantity),
      net: (row: ItemSummary) => Number(row.PriceWoVAT),
      vat: (row: ItemSummary) => Number(row.VATAmt),
      total: (row: ItemSummary) => Number(row.Price),
      invoices: (row: ItemSummary) => Number(row.Invoices),
    }[sort.key] ?? ((row: ItemSummary) => Number(row.Price));
  return sortBy(rows, read, sort.dir);
}
