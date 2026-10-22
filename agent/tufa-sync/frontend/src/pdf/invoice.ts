// An invoice as an A4 document: header, parties, details, items, totals with the VAT breakdown,
// payments, fiscal codes and the verification QR code. Amounts are in ALL, as CIS reports them.
import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { maybeKey, type Lang, type Translate } from "../i18n";
import { cents, documentDate, money, quantity } from "../lib/format";
import { invoiceNumber, isEinvoice, netAmount, verificationUrl } from "../lib/invoice";
import { unitOf } from "../lib/units";
import type { Environment, Invoice, Party } from "../types";
import { boxLayout, documentBase, gridLayout, heading, SHADE } from "./common";

export interface PdfContext {
  t: Translate;
  lang: Lang;
  environment: Environment;
}

type Fact = [label: string, value: string | undefined | null];

const QR_SIZE = 116;

const present = (facts: Fact[]) => facts.filter((fact): fact is [string, string] => Boolean(fact[1]));

export function paymentLabel(type: string | undefined, t: Translate): string {
  const key = maybeKey(`pay.${type}`);
  return key ? t(key) : type || "";
}

function partyBox(title: string, party: Party | undefined, missing: string): Content {
  if (!party)
    return {
      stack: [
        heading(title),
        { table: { widths: ["*"], body: [[{ text: missing, style: "muted" }]] }, layout: boxLayout },
      ],
    };
  const lines: Content[] = [{ text: party.Name || "—", bold: true, fontSize: 10 }];
  if (party.IDNum)
    lines.push({
      text: `${!party.IDType || party.IDType === "NUIS" ? "NIPT" : party.IDType}: ${party.IDNum}`,
    });
  const address = [party.Address, party.Town, party.Country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  if (address) lines.push({ text: address, style: "muted" });
  return {
    stack: [heading(title), { table: { widths: ["*"], body: [[{ stack: lines }]] }, layout: boxLayout }],
  };
}

/** Label / value pairs, two pairs per row. */
function factsBox(title: string, facts: Fact[]): Content | null {
  const shown = present(facts);
  if (!shown.length) return null;
  const body: TableCell[][] = [];
  for (let i = 0; i < shown.length; i += 2) {
    const row: TableCell[] = [];
    for (const [label, value] of shown.slice(i, i + 2).concat(i + 1 < shown.length ? [] : [["", ""]]))
      row.push({ text: label, style: "muted" }, { text: value });
    body.push(row);
  }
  return {
    stack: [heading(title), { table: { widths: [92, "*", 92, "*"], body }, layout: boxLayout }],
    margin: [0, 0, 0, 12],
  };
}

function itemsTable(invoice: Invoice, { t, lang }: PdfContext): Content {
  const right = { alignment: "right" as const };
  const head: TableCell[] = [
    t("pdf.col.no"),
    t("pdf.col.name"),
    t("pdf.col.unit"),
    t("pdf.col.qty"),
    t("pdf.col.price"),
    t("pdf.col.discount"),
    t("pdf.col.rate"),
    t("pdf.col.net"),
    t("pdf.col.vat"),
    t("pdf.col.total"),
  ].map((text, index) => ({ text, style: "th", ...(index >= 3 ? right : {}) }));
  const rows: TableCell[][] = (invoice.Items || []).map((item, index) => [
    { text: String(index + 1), style: "muted" },
    { stack: [{ text: item.N || "" }, ...(item.C ? [{ text: item.C, style: ["muted", "small"] }] : [])] },
    { text: unitOf(item.U, lang).label || "-" },
    { text: quantity(item.Q), ...right },
    { text: money(item.UPB), ...right },
    { text: Number(item.R) ? quantity(item.R) : "", ...right },
    {
      text: item.EX ? `${t("pdf.exempt")} ${item.EX}` : item.VR !== undefined ? quantity(item.VR) : "",
      ...right,
    },
    { text: money(item.PB), ...right },
    { text: money(item.VA), ...right },
    { text: money(item.PA), bold: true, ...right },
  ]);
  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: [16, "*", 34, 36, 50, 28, 30, 52, 44, 54],
      body: [head, ...rows],
    },
    layout: gridLayout,
    fontSize: 8,
    margin: [0, 0, 0, 10],
  };
}

/** VAT per rate: from CIS's breakdown, or worked out from the lines when the invoice has none. */
function vatBreakdown(invoice: Invoice, t: Translate): [string, string, string][] {
  if (invoice.SameTaxes?.length) {
    return invoice.SameTaxes.map((tax) => [
      tax.ExemptFromVAT ? `${t("pdf.exempt")} ${tax.ExemptFromVAT}` : `${quantity(tax.VATRate)}%`,
      money(tax.PriceBefVAT),
      money(tax.VATAmt),
    ]);
  }
  const rates = new Map<string, { base: number; vat: number }>();
  for (const item of invoice.Items || []) {
    const rate = item.EX ? `${t("pdf.exempt")} ${item.EX}` : `${quantity(item.VR ?? "0")}%`;
    const entry = rates.get(rate) ?? { base: 0, vat: 0 };
    entry.base += cents(item.PB);
    entry.vat += cents(item.VA);
    rates.set(rate, entry);
  }
  return [...rates].map(([rate, { base, vat }]) => [rate, money(base / 100), money(vat / 100)]);
}

function totalsBlock(invoice: Invoice, { t }: PdfContext): Content {
  const optional = (label: string, value?: string): [string, string][] =>
    Number(value) ? [[label, money(value)]] : [];
  const totals: [string, string][] = [
    [t("pdf.net"), money(netAmount(invoice))],
    [t("pdf.vat"), money(invoice.TotVATAmt)],
    ...optional(t("pdf.taxFree"), invoice.TaxFreeAmt),
    ...optional(t("pdf.markUp"), invoice.MarkUpAmt),
    ...optional(t("pdf.export"), invoice.GoodsExAmt),
  ];
  const taxes = vatBreakdown(invoice, t);
  return {
    unbreakable: true,
    columnGap: 16,
    margin: [0, 0, 0, 12],
    columns: [
      taxes.length
        ? {
            width: "*",
            stack: [
              heading(t("pdf.taxes")),
              {
                table: {
                  headerRows: 1,
                  widths: ["*", 70, 60],
                  body: [
                    [
                      { text: t("pdf.taxRate"), style: "th" },
                      { text: t("pdf.taxBase"), style: ["th", "right"] },
                      { text: t("pdf.taxVat"), style: ["th", "right"] },
                    ],
                    ...taxes.map(([rate, base, vat]) => [
                      rate,
                      { text: base, style: "right" },
                      { text: vat, style: "right" },
                    ]),
                  ],
                },
                layout: boxLayout,
              },
            ],
          }
        : { width: "*", text: "" },
      {
        width: 220,
        table: {
          widths: ["*", 80],
          body: [
            ...totals.map(([label, value]) => [
              { text: label, style: "muted" },
              { text: value, style: "right" },
            ]),
            [
              { text: t("pdf.toPay"), bold: true, fillColor: SHADE, margin: [0, 2, 0, 2] },
              {
                text: money(invoice.TotPrice),
                bold: true,
                fontSize: 11,
                alignment: "right",
                fillColor: SHADE,
                margin: [0, 1, 0, 1],
              },
            ],
          ],
        },
        layout: boxLayout,
      },
    ],
  };
}

/** Payments and fiscal codes on the left, the verification QR code on the right. */
function closingBlock(invoice: Invoice, context: PdfContext): Content {
  const { t } = context;
  const codes = present([
    ["NSLF", invoice.IIC],
    ["NIVF", invoice.FIC],
    ["EIC", invoice.EIC],
    [t("pdf.corrects"), invoice.CorrectiveInv?.IICRef],
    [t("pdf.badDebt"), invoice.BadDebtInv?.IICRef],
    ...(invoice.SumInvIICRefs || []).map((ref): Fact => [t("pdf.summarises"), ref.IIC]),
  ]);
  const payments = invoice.PayMethods || [];
  const verify = verificationUrl(invoice, context.environment);
  const left: Content[] = [];
  if (payments.length) {
    left.push(heading(t("pdf.payments")), {
      table: {
        headerRows: 1,
        widths: ["*", 80],
        body: [
          [
            { text: t("pdf.payType"), style: "th" },
            { text: t("pdf.payAmount"), style: ["th", "right"] },
          ],
          ...payments.map((pay) => [paymentLabel(pay.Type, t), { text: money(pay.Amt), style: "right" }]),
        ],
      },
      layout: boxLayout,
      margin: [0, 0, 0, 12],
    });
  }
  if (codes.length) {
    left.push(heading(t("pdf.fiscal")), {
      table: {
        widths: [88, "*"],
        body: codes.map(([label, value]) => [
          { text: label, style: "muted" },
          { text: value, fontSize: 7.5 },
        ]),
      },
      layout: boxLayout,
    });
  }
  return {
    unbreakable: true,
    columnGap: 20,
    columns: [
      { width: "*", stack: left },
      // The verification link is long, so the QR code is large and uses low error
      // correction (fewer, bigger modules) to scan well from paper.
      verify
        ? {
            width: QR_SIZE,
            stack: [
              { qr: verify, fit: QR_SIZE, eccLevel: "L" },
              {
                text: t("pdf.verify"),
                style: ["muted", "small"],
                alignment: "center",
                margin: [0, 4, 0, 0],
              },
            ],
          }
        : { width: QR_SIZE, text: "" },
    ],
  };
}

export function invoiceContent(invoice: Invoice, context: PdfContext): Content[] {
  const { t } = context;
  const subtitle = [
    invoice.TypeOfInv === "CASH" || invoice.TypeOfInv === "NONCASH"
      ? t(`pdf.kind.${invoice.TypeOfInv}`)
      : invoice.TypeOfInv,
    isEinvoice(invoice) ? t("badge.einvoice") : "",
    invoice.CorrectiveInv ? t("pdf.corrective") : "",
    invoice.CorrectiveInv?.Type === "CREDIT" || invoice.CorrectiveInv?.Type === "DEBIT"
      ? t(`badge.${invoice.CorrectiveInv.Type}`)
      : "",
    invoice.SumInvIICRefs?.length ? t("pdf.summary") : "",
  ]
    .filter(Boolean)
    .join("  ·  ");
  const currency = invoice.Currency;
  const supply = invoice.SupplyDateOrPeriod;
  const details = factsBox(t("pdf.details"), [
    [t("pdf.issued"), documentDate(invoice.IssueDateTime)],
    [t("pdf.deadline"), documentDate(invoice.PayDeadline, false)],
    [t("pdf.operator"), invoice.OperatorCode],
    [t("pdf.unit"), invoice.BusinUnitCode],
    [t("pdf.tcr"), invoice.TCRCode],
    [t("pdf.software"), invoice.SoftCode],
    [
      t("pdf.supply"),
      supply ? `${documentDate(supply.Start, false)} – ${documentDate(supply.End, false)}` : "",
    ],
    [
      t("pdf.rate"),
      currency?.Code && currency.Code !== "ALL" ? `1 ${currency.Code} = ${currency.ExRate} ALL` : "",
    ],
    [t("pdf.reverse"), invoice.IsReverseCharge === "true" ? t("pdf.reverseText") : ""],
    [t("pdf.selfIssue"), invoice.TypeOfSelfIss],
    [t("pdf.customs"), invoice.ImpCustDecNum],
  ]);
  return [
    {
      columns: [
        {
          stack: [
            { text: t("pdf.invoice").toUpperCase(), style: "title" },
            { text: subtitle, style: "muted", margin: [0, 3, 0, 0] },
          ],
        },
        {
          width: "auto",
          stack: [
            { text: t("pdf.number"), style: ["muted", "small"], alignment: "right" },
            { text: invoiceNumber(invoice), bold: true, fontSize: 13, alignment: "right" },
            {
              text: documentDate(invoice.IssueDateTime),
              alignment: "right",
              margin: [0, 2, 0, 0],
            },
          ],
        },
      ],
      margin: [0, 0, 0, 16],
    },
    {
      columns: [
        partyBox(t("pdf.seller"), invoice.Seller, "—"),
        partyBox(t("pdf.buyer"), invoice.Buyer, t("pdf.noBuyer")),
      ],
      columnGap: 12,
      margin: [0, 0, 0, 12],
    },
    ...(details ? [details] : []),
    itemsTable(invoice, context),
    totalsBlock(invoice, context),
    closingBlock(invoice, context),
  ];
}

/** One or many invoices; each starts on a new page. */
export function invoicesDocument(
  invoices: Invoice[],
  context: PdfContext,
  title: string,
): TDocumentDefinitions {
  const content = invoices.flatMap((invoice, index) => {
    const parts = invoiceContent(invoice, context);
    return index ? [{ text: "", pageBreak: "before" as const }, ...parts] : parts;
  });
  return documentBase(title, context.t("pdf.note"), content, context.t);
}
