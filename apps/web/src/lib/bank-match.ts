/**
 * Përputhja e lëvizjeve bankare me faturat e papaguara (logjikë e pastër, e testuar).
 *   hyrje (in)  → fatura shitjeje;  dalje (out) → fatura blerjeje.
 * Pikët: numri i faturës në përshkrim (+60), shuma e barabartë me mbetjen (+30),
 *        emri i palës në përshkrim (+20). "high" = ≥ 80 DHE shuma e saktë → zgjidhet automatikisht.
 * Një pagesë mund të mbyllë disa fatura kur përshkrimi i përmend dhe shuma përputhet me totalin e tyre.
 */
import type { BankTx } from "./bank-statement";

export type OpenInvoice = {
  id: string;
  direction: "sale" | "purchase";
  number: string | null;
  issue_date: string;
  outstanding: number;
  counterparty_name: string | null;
};

export type Match = {
  tx: BankTx;
  invoices: OpenInvoice[];
  score: number;
  confidence: "high" | "medium" | "low" | "none";
  reasons: string[];
  /** shuma e faturave të propozuara ≠ shuma e lëvizjes (pagesë e pjesshme ose tepricë) */
  amountMismatch: boolean;
};

const STOP = new Set(["SHPK", "SH.P.K", "SH.P.K.", "SHA", "SH.A", "PF", "P.F", "PERSON", "FIZIK", "AL", "ALBANIA", "SPA", "SRL", "LTD", "BV", "DHE", "THE"]);

export function nameTokens(name: string | null): string[] {
  return (name ?? "")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

/** Referencat "324/2026", "NR 12 / 2026" → [{num:"324", year:2026}] (datat me pikë nuk kapen). */
export function invoiceRefs(description: string): { num: string; year: number }[] {
  const out: { num: string; year: number }[] = [];
  for (const m of description.matchAll(/(?<![\d.])(\d{1,7})\s*\/\s*(20\d{2})(?!\d)/g)) out.push({ num: String(Number(m[1])), year: Number(m[2]) });
  return out;
}

function invoiceNum(inv: OpenInvoice): string | null {
  const m = (inv.number ?? "").match(/^(\d+)/);
  return m ? String(Number(m[1])) : null;
}

const eq = (a: number, b: number) => Math.abs(a - b) < 0.01;

function score(tx: BankTx, invs: OpenInvoice[], refHit: boolean): Omit<Match, "tx" | "invoices"> {
  const reasons: string[] = [];
  let s = 0;
  if (refHit) { s += 60; reasons.push("numri i faturës"); }
  const sum = invs.reduce((a, i) => a + i.outstanding, 0);
  const amountOk = eq(sum, tx.amount);
  if (amountOk) { s += 30; reasons.push("shuma"); }
  const desc = tx.description.toUpperCase();
  const tokens = [...new Set(invs.flatMap((i) => nameTokens(i.counterparty_name)))];
  if (tokens.length && tokens.some((t) => desc.includes(t))) { s += 20; reasons.push("emri"); }
  // Shuma e ndryshme (pagesë e pjesshme / tepricë) nuk zgjidhet kurrë automatikisht
  const confidence = s >= 80 && amountOk ? "high" : s >= 50 ? "medium" : s > 0 ? "low" : "none";
  return { score: s, confidence, reasons, amountMismatch: !amountOk };
}

export function matchTransactions(txs: BankTx[], open: OpenInvoice[]): Match[] {
  const used = new Set<string>();
  const proposals = txs.map((tx) => {
    const dir = tx.direction === "in" ? "sale" : "purchase";
    const pool = open.filter((i) => i.direction === dir && i.issue_date <= tx.date);
    const refs = invoiceRefs(tx.description);

    // 1) Sipas numrit të faturës (një ose disa)
    if (refs.length) {
      const byRef = refs
        .map((r) => {
          const c = pool.filter((i) => invoiceNum(i) === r.num && i.issue_date.startsWith(String(r.year)));
          // nëse ka disa me të njëjtin numër (njësi të ndryshme), preferohet ajo me shumën ose emrin
          return c.sort((a, b) => Number(eq(b.outstanding, tx.amount)) - Number(eq(a.outstanding, tx.amount)))[0];
        })
        .filter((i): i is OpenInvoice => !!i);
      const unique = [...new Map(byRef.map((i) => [i.id, i])).values()];
      if (unique.length) return { tx, invoices: unique, ...score(tx, unique, true) };
    }

    // 2) Pa numër: shuma e barabartë + emri; ose vetëm shuma kur është unike
    const sameAmount = pool.filter((i) => eq(i.outstanding, tx.amount));
    const desc = tx.description.toUpperCase();
    const withName = sameAmount.filter((i) => nameTokens(i.counterparty_name).some((t) => desc.includes(t)));
    const pick = withName.length ? withName : sameAmount.length === 1 ? sameAmount : [];
    if (pick.length) {
      const oldest = [...pick].sort((a, b) => a.issue_date.localeCompare(b.issue_date))[0];
      return { tx, invoices: [oldest], ...score(tx, [oldest], false) };
    }
    return { tx, invoices: [] as OpenInvoice[], score: 0, confidence: "none" as const, reasons: [], amountMismatch: false };
  });

  // Një faturë i caktohet vetëm një lëvizjeje: fiton pikët më të larta
  const order = proposals.map((p, i) => i).sort((a, b) => proposals[b].score - proposals[a].score);
  for (const i of order) {
    const p = proposals[i];
    if (p.invoices.some((inv) => used.has(inv.id))) {
      proposals[i] = { ...p, invoices: [], score: 0, confidence: "none", reasons: ["fatura u përdor nga një lëvizje tjetër"], amountMismatch: false };
      continue;
    }
    p.invoices.forEach((inv) => used.add(inv.id));
  }
  return proposals;
}
