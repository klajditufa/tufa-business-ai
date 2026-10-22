import type { Environment, Invoice, Kind, Party } from "../types";

/** Date range lists leave out TotPriceWoVAT; it equals TotPrice - TotVATAmt. */
export function netAmount(invoice: Invoice): string {
  if (invoice.TotPriceWoVAT) return invoice.TotPriceWoVAT;
  if (invoice.TotPrice === undefined) return "";
  return ((Number(invoice.TotPrice) || 0) - (Number(invoice.TotVATAmt) || 0)).toFixed(2);
}

/** The other party: the buyer of a sale, the seller of a purchase. */
export function counterparty(invoice: Invoice, kind: Kind): Party {
  return (kind === "SALES" ? invoice.Buyer : invoice.Seller) || {};
}

export const invoiceNumber = (invoice: Invoice): string => invoice.InvNum || invoice.InvOrdNum || "";

export const isEinvoice = (invoice: Invoice): boolean =>
  invoice.IsEinvoice === "true" || Boolean(invoice.EIC);

/** Public CIS page that verifies the invoice: the URL in the invoice's QR code. */
export function verificationUrl(invoice: Invoice, environment: Environment): string | null {
  if (!invoice.IIC) return null;
  const seller = invoice.Seller || {};
  const buyer = invoice.Buyer || {};
  const host =
    environment === "production" ? "efiskalizimi-app.tatime.gov.al" : "efiskalizimi-app-test.tatime.gov.al";
  const params = new URLSearchParams({
    iic: invoice.IIC,
    tin: (invoice.TypeOfSelfIss ? buyer.IDNum : seller.IDNum) || "", // a self-issued invoice is issued by the buyer
    crtd: invoice.IssueDateTime || "",
    ord: invoice.InvOrdNum || "",
    bu: invoice.BusinUnitCode || "",
    cr: invoice.TCRCode || "",
    sw: invoice.SoftCode || "",
    prc: invoice.TotPrice || "",
  });
  return `https://${host}/invoice-check/#/verify?${params}`;
}

// Same columns as the command line CSV export (cis_client/convert.py).
export const INVOICE_CSV_COLUMNS = [
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
] as const;

export type InvoiceRow = Record<(typeof INVOICE_CSV_COLUMNS)[number], string | undefined>;

export function flattenInvoice(invoice: Invoice, environment: Environment): InvoiceRow {
  const seller = invoice.Seller || {};
  const buyer = invoice.Buyer || {};
  const currency = invoice.Currency || {};
  const corrective = invoice.CorrectiveInv || {};
  return {
    IssueDateTime: invoice.IssueDateTime,
    InvNum: invoiceNumber(invoice),
    TypeOfInv: invoice.TypeOfInv,
    IsEinvoice: invoice.IsEinvoice,
    SellerNIPT: seller.IDNum,
    SellerName: seller.Name,
    BuyerNIPT: buyer.IDNum,
    BuyerName: buyer.Name,
    Currency: currency.Code || "ALL",
    ExRate: currency.ExRate,
    TotPriceWoVAT: netAmount(invoice),
    TotVATAmt: invoice.TotVATAmt,
    TotPrice: invoice.TotPrice,
    PayMethods: (invoice.PayMethods || []).map((pay) => `${pay.Type || ""}:${pay.Amt || ""}`).join("; "),
    BusinUnitCode: invoice.BusinUnitCode,
    TCRCode: invoice.TCRCode,
    OperatorCode: invoice.OperatorCode,
    CorrectiveType: corrective.Type,
    CorrectiveIICRef: corrective.IICRef,
    FIC: invoice.FIC,
    IIC: invoice.IIC,
    EIC: invoice.EIC,
    VerificationUrl: verificationUrl(invoice, environment) ?? undefined,
  };
}
