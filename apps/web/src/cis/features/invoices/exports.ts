// What the export buttons produce: CSV files and PDF reports of the period on screen.
import type { Translate } from "../../i18n";
import { cents, documentDate, formatDate, isoDay, money, quantity } from "../../lib/format";
import {
  counterparty,
  flattenInvoice,
  INVOICE_CSV_COLUMNS,
  invoiceNumber,
  isEinvoice,
  netAmount,
} from "../../lib/invoice";
import {
  flattenLine,
  ITEM_SUMMARY_COLUMNS,
  LINE_CSV_COLUMNS,
  shortCodes,
  type ItemSummary,
  type Line,
} from "../../lib/items";
import { download, toCsv } from "../../lib/files";
import type { Report } from "../../pdf/report";
import type { CertificateBusiness, Environment, Invoice, Kind } from "../../types";

export const invoicesCsv = (rows: Invoice[], environment: Environment, name: string) => {
  download(
    `${name}.csv`,
    toCsv(
      rows.map((row) => flattenInvoice(row, environment)),
      INVOICE_CSV_COLUMNS,
    ),
  );
};

export const invoicesJson = (rows: Invoice[], name: string) => {
  download(`${name}.json`, JSON.stringify(rows, null, 2), "application/json");
};

export const summaryCsv = (rows: ItemSummary[], name: string) => {
  download(`${name}_items.csv`, toCsv(rows, ITEM_SUMMARY_COLUMNS));
};

export const linesCsv = (lines: Line[], environment: Environment, name: string) => {
  download(
    `${name}_lines.csv`,
    toCsv(
      lines.map((line) => flattenLine(line, environment)),
      LINE_CSV_COLUMNS,
    ),
  );
};

const sum = <T>(rows: T[], read: (row: T) => string | undefined) =>
  money(rows.reduce((total, row) => total + cents(read(row)), 0) / 100);

interface ReportScope {
  t: Translate;
  kind: Kind;
  business: CertificateBusiness;
  period: { from: string; to: string };
  filter: string;
}

function reportHead({ t, kind, business, period, filter }: ReportScope, suffix?: string) {
  const cert = business.certificate;
  return {
    title: [t(kind === "SALES" ? "tabs.sales" : "tabs.purchases"), suffix].filter(Boolean).join(" · "),
    subtitle: [cert.name || cert.commonName, cert.nipt ? `NIPT ${cert.nipt}` : ""]
      .filter(Boolean)
      .join(" · "),
    details: [
      `${t("inv.period")}: ${documentDate(period.from, false)} – ${documentDate(period.to, false)}`,
      filter ? `${t("pdf.filter")}: ${filter}` : "",
      t("pdf.generated", { date: documentDate(isoDay(new Date()), false) }),
    ].filter(Boolean),
  };
}

export function invoiceListReport(rows: Invoice[], scope: ReportScope): Report<Invoice> {
  const { t, kind } = scope;
  return {
    ...reportHead(scope),
    columns: [
      { label: t("col.date"), value: (invoice) => formatDate(invoice.IssueDateTime) },
      { label: t("col.number"), value: invoiceNumber },
      {
        label: t(kind === "SALES" ? "col.buyer" : "col.seller"),
        value: (invoice) => counterparty(invoice, kind).Name,
        width: "*",
      },
      { label: t("col.nipt"), value: (invoice) => counterparty(invoice, kind).IDNum },
      {
        label: t("col.type"),
        value: (invoice) =>
          [
            t(invoice.TypeOfInv === "CASH" ? "type.CASH" : "type.NONCASH"),
            isEinvoice(invoice) ? t("badge.einvoice") : "",
          ]
            .filter(Boolean)
            .join(" · "),
      },
      { label: t("col.net"), value: (invoice) => money(netAmount(invoice)), right: true },
      { label: t("col.vat"), value: (invoice) => money(invoice.TotVATAmt), right: true },
      { label: t("col.total"), value: (invoice) => money(invoice.TotPrice), right: true },
    ],
    rows,
    totals: [
      "",
      "",
      `${t("pdf.total").toUpperCase()} · ${rows.length}`,
      "",
      "",
      sum(rows, netAmount),
      sum(rows, (row) => row.TotVATAmt),
      sum(rows, (row) => row.TotPrice),
    ],
  };
}

export function itemReport(rows: ItemSummary[], scope: ReportScope): Report<ItemSummary> {
  const { t } = scope;
  return {
    ...reportHead(scope, t("inv.mode.items")),
    columns: [
      { label: t("col.item"), value: (row) => row.ItemName, width: "*" },
      { label: t("item.code"), value: (row) => shortCodes(row.ItemCode) },
      { label: t("col.unit"), value: (row) => row.Unit },
      { label: t("col.qty"), value: (row) => quantity(row.Quantity), right: true },
      { label: t("col.net"), value: (row) => money(row.PriceWoVAT), right: true },
      { label: t("col.vat"), value: (row) => money(row.VATAmt), right: true },
      { label: t("col.total"), value: (row) => money(row.Price), right: true },
      { label: t("col.invoices"), value: (row) => row.Invoices, right: true },
    ],
    rows,
    totals: [
      `${t("pdf.total").toUpperCase()} · ${rows.length}`,
      "",
      "",
      "",
      sum(rows, (row) => row.PriceWoVAT),
      sum(rows, (row) => row.VATAmt),
      sum(rows, (row) => row.Price),
      "",
    ],
  };
}
