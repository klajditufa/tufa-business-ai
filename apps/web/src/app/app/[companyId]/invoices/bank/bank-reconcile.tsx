"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, ShieldCheck, TriangleAlert } from "lucide-react";
import { itemsToLines, parseStatement, type Statement, type TextItem } from "@/lib/bank-statement";
import { matchTransactions, type Match, type OpenInvoice } from "@/lib/bank-match";
import { setInvoicesPaymentAction } from "@/server/actions/invoices";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { date, money } from "@/lib/format";

/** Lexon PDF-në VETËM në browser (unpdf/pdf.js); skedari nuk dërgohet në server. */
async function readPdf(file: File): Promise<TextItem[]> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const items: TextItem[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    for (const it of tc.items as { str?: string; transform?: number[] }[]) {
      if (!it.str || !it.transform) continue;
      // faqet njëra pas tjetrës: y zbret me 10000 për çdo faqe që rendi të mbetet lart → poshtë
      items.push({ x: it.transform[4], y: it.transform[5] - (p - 1) * 10000, s: it.str });
    }
  }
  return items;
}

const confTone = { high: "success", medium: "warning", low: "neutral", none: "neutral" } as const;
const confLabel = { high: "e sigurt", medium: "kontrollo", low: "e dobët", none: "pa përputhje" } as const;

export function BankReconcile({ companyId, open, currency, canWrite }: { companyId: string; open: OpenInvoice[]; currency: string; canWrite: boolean }) {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [st, setSt] = useState<Statement | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [manual, setManual] = useState<Record<number, string>>({});
  const [done, setDone] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const matches: Match[] = useMemo(() => (st ? matchTransactions(st.transactions, open) : []), [st, open]);
  const byId = useMemo(() => new Map(open.map((i) => [i.id, i])), [open]);

  const invoicesFor = (i: number) => {
    const m = matches[i];
    if (manual[i]) return [byId.get(manual[i])!].filter(Boolean);
    return m.invoices;
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setErr(null); setResult(null); setSt(null); setPicked({}); setManual({}); setDone(new Set());
    setFileName(file.name);
    setReading(true);
    try {
      const parsed = parseStatement(itemsToLines(await readPdf(file)));
      if (parsed.transactions.length === 0) setErr("Nuk u gjet asnjë lëvizje. Sigurohu që është ekstrakti bankar në PDF (jo foto e skanuar).");
      setSt(parsed);
      const m = matchTransactions(parsed.transactions, open);
      setPicked(Object.fromEntries(m.map((x, i) => [i, x.confidence === "high"])));
    } catch (e) {
      setErr(`PDF-ja nuk u lexua: ${(e as Error).message}`);
    } finally {
      setReading(false);
    }
  };

  const selected = matches.map((_, i) => i).filter((i) => picked[i] && !done.has(i) && invoicesFor(i).length > 0);

  const apply = () =>
    start(async () => {
      setResult(null);
      // grupim sipas datës së bankës → paid_at = data e lëvizjes
      const groups = new Map<string, { idx: number[]; ids: string[] }>();
      for (const i of selected) {
        const g = groups.get(matches[i].tx.date) ?? { idx: [], ids: [] };
        g.idx.push(i);
        g.ids.push(...invoicesFor(i).map((inv) => inv.id));
        groups.set(matches[i].tx.date, g);
      }
      let ok = 0;
      const errors: string[] = [];
      const finished = new Set(done);
      for (const [paidAt, g] of groups) {
        const res = await setInvoicesPaymentAction({ companyId, ids: g.ids, status: "paid", paidAt, method: "bank" });
        if (res.error) { errors.push(res.error); continue; }
        ok += res.updated;
        res.failed.forEach((f) => errors.push(f.error));
        if (res.failed.length === 0) g.idx.forEach((i) => finished.add(i));
      }
      setDone(finished);
      setResult(errors.length ? { tone: "danger", text: `${ok} fatura u shënuan të paguara; gabime: ${[...new Set(errors)].join("; ")}` } : { tone: "success", text: `${ok} fatura u shënuan të paguara me datën e bankës.` });
      router.refresh();
    });

  const ins = st?.transactions.filter((t) => t.direction === "in") ?? [];
  const outs = st?.transactions.filter((t) => t.direction === "out") ?? [];

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-8 text-center text-sm hover:bg-muted/40">
          <FileUp className="h-6 w-6 text-muted-foreground" />
          <span className="font-medium">{fileName ?? "Zgjidh ekstraktin bankar (PDF)"}</span>
          <span className="text-xs text-muted-foreground">{reading ? "Duke lexuar…" : "ose tërhiqe këtu"}</span>
          <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          Ekstrakti lexohet vetëm në këtë browser dhe nuk ngarkohet në server. Në platformë ruhet vetëm që fatura u pagua dhe data e pagesës.
        </p>
      </Card>

      {err && <Alert tone="danger">{err}</Alert>}

      {st && st.transactions.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="p-3"><div className="text-xs text-muted-foreground">Llogaria</div><div className="truncate text-sm font-semibold">{st.accountHolder ?? "—"}</div><div className="font-mono text-[11px] text-muted-foreground">{st.iban ? `${st.iban.slice(0, 4)} … ${st.iban.slice(-4)}` : ""}</div></Card>
            <Card className="p-3"><div className="text-xs text-muted-foreground">Hyrje</div><div className="text-lg font-semibold tabular">{ins.length} · {money(ins.reduce((a, t) => a + t.amount, 0), currency, 0)}</div></Card>
            <Card className="p-3"><div className="text-xs text-muted-foreground">Dalje</div><div className="text-lg font-semibold tabular">{outs.length} · {money(outs.reduce((a, t) => a + t.amount, 0), currency, 0)}</div></Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Kontrolli i balancës</div>
              {st.balanced ? (
                <div className="flex items-center gap-1 text-sm font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> u lexua plotësisht</div>
              ) : (
                <div className="flex items-center gap-1 text-sm font-semibold text-warning"><TriangleAlert className="h-4 w-4" /> kontrollo leximin</div>
              )}
              <div className="text-[11px] text-muted-foreground tabular">{money(st.openingBalance ?? 0, currency, 0)} → {money(st.closingBalance ?? 0, currency, 0)}</div>
            </Card>
          </div>

          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  {canWrite && <th className="w-8 px-3 py-2" />}
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Përshkrimi në bankë</th>
                  <th className="px-3 py-2 text-right">Shuma</th>
                  <th className="px-3 py-2">Fatura e propozuar</th>
                  <th className="px-3 py-2">Përputhja</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => {
                  const invs = invoicesFor(i);
                  const isDone = done.has(i);
                  const dir = m.tx.direction === "in" ? "sale" : "purchase";
                  const options = open
                    .filter((o) => o.direction === dir && o.issue_date <= m.tx.date)
                    .sort((a, b) => Math.abs(a.outstanding - m.tx.amount) - Math.abs(b.outstanding - m.tx.amount))
                    .slice(0, 12);
                  return (
                    <tr key={i} className={`border-t border-border align-top ${isDone ? "opacity-60" : ""}`}>
                      {canWrite && (
                        <td className="px-3 py-2">
                          {isDone ? <CheckCircle2 className="h-4 w-4 text-success" /> : (
                            <input type="checkbox" aria-label="Zgjidh" disabled={invs.length === 0} checked={!!picked[i] && invs.length > 0} onChange={(e) => setPicked((p) => ({ ...p, [i]: e.target.checked }))} />
                          )}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-3 py-2 tabular">{date(m.tx.date)}</td>
                      <td className="max-w-sm px-3 py-2 text-xs">{m.tx.description || "—"}</td>
                      <td className={`whitespace-nowrap px-3 py-2 text-right font-medium tabular ${m.tx.direction === "in" ? "text-success" : ""}`}>
                        {m.tx.direction === "in" ? "+" : "−"}{money(m.tx.amount, currency)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {invs.map((inv) => (
                          <div key={inv.id}>
                            Nr. <span className="font-mono">{inv.number ?? "—"}</span> · {date(inv.issue_date)} · {inv.counterparty_name} · <span className="tabular">{money(inv.outstanding, currency)}</span>
                          </div>
                        ))}
                        {canWrite && !isDone && (
                          <select
                            className="mt-1 h-8 max-w-64 rounded border border-border bg-background px-1 text-xs"
                            value={manual[i] ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setManual((s) => ({ ...s, [i]: v }));
                              setPicked((p) => ({ ...p, [i]: !!v || (m.confidence === "high") }));
                            }}
                          >
                            <option value="">{invs.length ? "ndrysho…" : "zgjidh faturën…"}</option>
                            {options.map((o) => (
                              <option key={o.id} value={o.id}>{o.number ?? "—"} · {o.counterparty_name} · {money(o.outstanding, currency, 0)}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {manual[i] ? <Badge tone="info">manuale</Badge> : <Badge tone={confTone[m.confidence]}>{confLabel[m.confidence]}</Badge>}
                        {!manual[i] && m.reasons.length > 0 && <div className="mt-0.5 text-[11px] text-muted-foreground">{m.reasons.join(" + ")}</div>}
                        {!manual[i] && m.invoices.length > 0 && m.amountMismatch && <div className="mt-0.5 text-[11px] text-warning">shuma ndryshon nga fatura</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {canWrite && (
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" disabled={pending || selected.length === 0} onClick={apply}>
                <CheckCircle2 className="h-4 w-4" /> Shëno të paguara ({selected.reduce((a, i) => a + invoicesFor(i).length, 0)} fatura)
              </Button>
              <span className="text-xs text-muted-foreground">Data e pagesës = data e lëvizjes në bankë · mënyra: bankë</span>
            </div>
          )}
          {result && <Alert tone={result.tone}>{result.text}</Alert>}
        </>
      )}
    </div>
  );
}
