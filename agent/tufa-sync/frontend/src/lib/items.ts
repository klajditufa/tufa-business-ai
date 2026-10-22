import type { Lang } from "../i18n";
import type { Environment, Invoice, Item } from "../types";
import { cents } from "./format";
import { flattenInvoice } from "./invoice";
import { fold, nameKey, unitOf } from "./units";

/** One invoice line, with the (complete) invoice it belongs to. */
export interface Line {
  invoice: Invoice;
  item: Item;
}

export interface ItemSummary {
  key: string;
  ItemCode: string;
  ItemName: string;
  Unit: string;
  UnitCode: string;
  Quantity: string;
  PriceWoVAT: string;
  VATAmt: string;
  Price: string;
  Invoices: string;
}

/** Lines with the same name (ignoring case and accents) and unit are the same item; codes differ between issuers. */
export const itemKey = (item: Item): string => `${nameKey(item.N)}\u0000${unitOf(item.U, "sq").key}`;

/**
 * Lines grouped by item, largest total first. Amounts are summed in cents; corrective
 * invoices carry negative lines and reduce the totals of the items they correct.
 */
export function summarise(lines: Line[], lang: Lang): ItemSummary[] {
  const groups = new Map<
    string,
    {
      name: string;
      unit: string;
      unitCode: string;
      codes: Map<string, string>;
      qty: number;
      net: number;
      vat: number;
      total: number;
      invoices: Set<string | undefined>;
    }
  >();
  for (const { invoice, item } of lines) {
    const key = itemKey(item);
    let group = groups.get(key);
    if (!group) {
      const unit = unitOf(item.U, lang);
      group = {
        name: (item.N || "").trim(),
        unit: unit.label,
        unitCode: unit.code,
        codes: new Map(),
        qty: 0,
        net: 0,
        vat: 0,
        total: 0,
        invoices: new Set(),
      };
      groups.set(key, group);
    }
    const code = (item.C || "").trim();
    if (code && !group.codes.has(fold(code))) group.codes.set(fold(code), code);
    group.qty += Number(item.Q) || 0;
    group.net += cents(item.PB);
    group.vat += cents(item.VA);
    group.total += cents(item.PA);
    group.invoices.add(invoice.FIC || invoice.IIC);
  }
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      ItemCode: [...group.codes.values()].join(" / "),
      ItemName: group.name,
      Unit: group.unit,
      UnitCode: group.unitCode,
      Quantity: String(Number(group.qty.toFixed(6))),
      PriceWoVAT: (group.net / 100).toFixed(2),
      VATAmt: (group.vat / 100).toFixed(2),
      Price: (group.total / 100).toFixed(2),
      Invoices: String(group.invoices.size),
    }))
    .sort((a, b) => Number(b.Price) - Number(a.Price) || a.ItemName.localeCompare(b.ItemName));
}

/** The codes of an item for display: the first few, then how many more ("A1 / A2 / A3 +4"). */
export function shortCodes(codes: string, shown = 3): string {
  const list = codes ? codes.split(" / ") : [];
  return list.length > shown ? `${list.slice(0, shown).join(" / ")} +${list.length - shown}` : codes;
}

// Same columns as the command line exports (cis_client/convert.py).
export const ITEM_SUMMARY_COLUMNS = [
  "ItemCode",
  "ItemName",
  "Unit",
  "UnitCode",
  "Quantity",
  "PriceWoVAT",
  "VATAmt",
  "Price",
  "Invoices",
] as const;

export const LINE_CSV_COLUMNS = [
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
] as const;

export function flattenLine(
  { invoice, item }: Line,
  environment: Environment,
): Record<(typeof LINE_CSV_COLUMNS)[number], string | undefined> {
  const head = flattenInvoice(invoice, environment);
  return {
    IssueDateTime: head.IssueDateTime,
    InvNum: head.InvNum,
    TypeOfInv: head.TypeOfInv,
    SellerNIPT: head.SellerNIPT,
    SellerName: head.SellerName,
    BuyerNIPT: head.BuyerNIPT,
    BuyerName: head.BuyerName,
    Currency: head.Currency,
    ExRate: head.ExRate,
    ItemName: item.N,
    ItemCode: item.C,
    Unit: item.U,
    UnitCode: unitOf(item.U, "sq").code,
    Quantity: item.Q,
    UnitPriceWoVAT: item.UPB,
    UnitPriceWithVAT: item.UPA,
    RebatePercent: item.R,
    VATRate: item.VR,
    PriceWoVAT: item.PB,
    VATAmt: item.VA,
    Price: item.PA,
    ExemptFromVAT: item.EX,
    Investment: item.IN,
    FIC: invoice.FIC,
  };
}
