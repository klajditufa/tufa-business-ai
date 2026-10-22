"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleSlash } from "lucide-react";
import { setInvoicesPaymentAction } from "@/server/actions/invoices";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { date, money } from "@/lib/format";

export type InvoiceRow = {
  id: string;
  number: string | null;
  nivf: string | null;
  nslf: string | null;
  issue_date: string;
  counterparty_name: string | null;
  counterparty_nipt: string | null;
  subtotal: number;
  vat_amount: number;
  total: number;
  paid_amount: number;
  paid_at: string | null;
  currency: string | null;
  type: string;
  payment_status: string;
  source: string;
  is_einvoice: boolean | null;
};

const sourceLabel: Record<string, string> = { connector: "CIS", import: "Import", manual: "Manuale" };
const typeLabel: Record<string, string> = { corrective: "Korrigjuese", cancelled: "Anuluar", summary: "Përmbledhëse" };

/** Tabela e regjistrit me zgjedhje dhe veprime pagese në grup. */
export function InvoiceTable({
  companyId, rows, direction, currency, canWrite,
}: { companyId: string; rows: InvoiceRow[]; direction: "sale" | "purchase"; currency: string; canWrite: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<"bank" | "cash" | "card" | "compensation" | "other">("bank");
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const active = useMemo(() => rows.filter((r) => r.type !== "cancelled"), [rows]);
  const sum = (k: "subtotal" | "vat_amount" | "total") => active.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const selectable = rows.filter((r) => r.type !== "cancelled");
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));
  const selectedTotal = rows.filter((r) => selected.has(r.id)).reduce((a, r) => a + Number(r.total), 0);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const apply = (status: "paid" | "unpaid") =>
    start(async () => {
      setMsg(null);
      const res = await setInvoicesPaymentAction({
        companyId,
        ids: [...selected],
        status,
        paidAt: status === "paid" ? paidAt : undefined,
        method: status === "paid" ? method : undefined,
      });
      if (res.error) {
        setMsg({ tone: "danger", text: res.error });
        return;
      }
      const label = status === "paid" ? "të paguara" : "të papaguara";
      setMsg(
        res.failed.length === 0
          ? { tone: "success", text: `${res.updated} fatura u shënuan ${label}.` }
          : { tone: "danger", text: `${res.updated} u shënuan ${label}; ${res.failed.length} dështuan: ${[...new Set(res.failed.map((f) => f.error))].join("; ")}` },
      );
      setSelected(new Set());
      router.refresh();
    });

  return (
    <div className="space-y-3">
      {canWrite && selected.size > 0 && (
        <Card className="sticky top-2 z-10 flex flex-wrap items-end gap-3 p-3 text-sm shadow-md">
          <div className="font-medium">
            {selected.size} të zgjedhura · {money(selectedTotal, currency)}
          </div>
          <label className="flex flex-col text-xs text-muted-foreground">
            Data e pagesës
            <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground" />
          </label>
          <label className="flex flex-col text-xs text-muted-foreground">
            Mënyra
            <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground">
              <option value="bank">Bankë</option>
              <option value="cash">Cash</option>
              <option value="card">Kartë</option>
              <option value="compensation">Kompensim</option>
              <option value="other">Tjetër</option>
            </select>
          </label>
          <Button type="button" size="sm" disabled={pending} onClick={() => apply("paid")}>
            <CheckCircle2 className="h-4 w-4" /> Shëno të paguara
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => apply("unpaid")}>
            <CircleSlash className="h-4 w-4" /> Të papaguara
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setSelected(new Set())}>
            Anulo
          </Button>
        </Card>
      )}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              {canWrite && (
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Zgjidh të gjitha"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((r) => r.id)))}
                  />
                </th>
              )}
              <th className="px-4 py-2">Data</th>
              <th className="px-4 py-2">Nr.</th>
              <th className="px-4 py-2">{direction === "sale" ? "Klienti" : "Furnitori"}</th>
              <th className="px-4 py-2 text-right">Pa TVSH</th>
              <th className="px-4 py-2 text-right">TVSH</th>
              <th className="px-4 py-2 text-right">Totali</th>
              <th className="px-4 py-2">Pagesa</th>
              <th className="px-4 py-2">Burimi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cur = r.currency ?? currency;
              const isSel = selected.has(r.id);
              return (
                <tr
                  key={r.id}
                  className={`border-t border-border ${r.type === "cancelled" ? "opacity-50" : ""} ${isSel ? "bg-accent/10" : ""}`}
                  onClick={canWrite && r.type !== "cancelled" ? (e) => {
                    if ((e.target as HTMLElement).closest("a,button,input")) return;
                    toggle(r.id);
                  } : undefined}
                >
                  {canWrite && (
                    <td className="px-3 py-2">
                      {r.type !== "cancelled" && <input type="checkbox" aria-label={`Zgjidh faturën ${r.number ?? ""}`} checked={isSel} onChange={() => toggle(r.id)} />}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-2 tabular">{date(r.issue_date)}</td>
                  <td className="px-4 py-2 font-mono text-xs" title={r.nivf ? `NIVF ${r.nivf}${r.nslf ? ` · NSLF ${r.nslf}` : ""}` : undefined}>
                    {r.number ?? "—"}
                    {r.is_einvoice && <span className="ml-1 rounded bg-muted px-1 text-[10px]">e-F</span>}
                  </td>
                  <td className="px-4 py-2">
                    <div>
                      {r.counterparty_name ?? "—"} {r.type !== "normal" && <Badge tone="warning" className="ml-1">{typeLabel[r.type] ?? r.type}</Badge>}
                    </div>
                    {r.counterparty_nipt && <div className="font-mono text-[11px] text-muted-foreground">{r.counterparty_nipt}</div>}
                  </td>
                  <td className="px-4 py-2 text-right tabular">{money(r.subtotal, cur)}</td>
                  <td className="px-4 py-2 text-right tabular">{money(r.vat_amount, cur)}</td>
                  <td className="px-4 py-2 text-right font-medium tabular">{money(r.total, cur)}</td>
                  <td className="px-4 py-2">
                    <Badge tone={r.payment_status === "paid" ? "success" : r.payment_status === "partial" ? "warning" : "danger"}>
                      {r.payment_status === "paid" ? "E paguar" : r.payment_status === "partial" ? "Pjesërisht" : "E papaguar"}
                    </Badge>
                    {r.payment_status === "paid" && r.paid_at && <div className="mt-0.5 text-[11px] text-muted-foreground">{date(r.paid_at)}</div>}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={r.source === "connector" ? "info" : "neutral"}>{sourceLabel[r.source] ?? r.source}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-border bg-muted/50 text-xs font-medium">
            <tr>
              <td className="px-4 py-2" colSpan={canWrite ? 4 : 3}>
                Totali ({active.length} fatura{rows.length !== active.length ? `, ${rows.length - active.length} të anuluara` : ""})
              </td>
              <td className="px-4 py-2 text-right tabular">{money(sum("subtotal"), currency)}</td>
              <td className="px-4 py-2 text-right tabular">{money(sum("vat_amount"), currency)}</td>
              <td className="px-4 py-2 text-right tabular">{money(sum("total"), currency)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </Card>
      {canWrite && <p className="text-xs text-muted-foreground">Kliko rreshtat (ose kutitë) për t&apos;i zgjedhur, pastaj shëno pagesën me datë dhe mënyrë.</p>}
    </div>
  );
}
