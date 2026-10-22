/** Kartela e palës: logjikë e pastër (pa DB) që testohet veçmas. */

export type LedgerInvoice = {
  id: string;
  number: string | null;
  nivf: string | null;
  issue_date: string;
  total: number | string;
  paid_amount: number | string | null;
  paid_at: string | null;
  payment_method: string | null;
  type: string;
};

export type LedgerEntry = {
  date: string;
  kind: "invoice" | "payment";
  invoiceId: string;
  label: string;
  debit: number;   // rrit detyrimin e palës (fatura)
  credit: number;  // ul detyrimin (pagesa, fatura korrigjuese negative)
  balance: number;
};

const METHOD: Record<string, string> = { bank: "bankë", cash: "cash", card: "kartë", compensation: "kompensim", other: "tjetër" };
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Faturat në datën e lëshimit (debi; korrigjueset negative si kredi) dhe pagesat në datën e pagesës (kredi),
 * në rend kronologjik — në të njëjtën datë fatura para pagesës — me gjendje progresive.
 */
export function buildLedger(invoices: LedgerInvoice[]): LedgerEntry[] {
  const raw: Omit<LedgerEntry, "balance">[] = [];
  for (const i of invoices) {
    const total = Number(i.total);
    const label = `Faturë ${i.number ?? i.nivf ?? ""}${i.type === "corrective" ? " (korrigjuese)" : ""}`.trim();
    raw.push({ date: i.issue_date, kind: "invoice", invoiceId: i.id, label, debit: total > 0 ? total : 0, credit: total < 0 ? -total : 0 });
    const paid = Math.min(Number(i.paid_amount ?? 0), Math.abs(total));
    if (paid > 0 && total > 0) {
      const how = i.payment_method && i.payment_method !== "unknown" ? ` · ${METHOD[i.payment_method] ?? i.payment_method}` : "";
      raw.push({ date: i.paid_at ?? i.issue_date, kind: "payment", invoiceId: i.id, label: `Pagesë për ${i.number ?? "faturën"}${how}`, debit: 0, credit: paid });
    }
  }
  raw.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === "invoice" ? -1 : 1));
  let bal = 0;
  return raw.map((e) => {
    bal = r2(bal + e.debit - e.credit);
    return { ...e, balance: bal };
  });
}
