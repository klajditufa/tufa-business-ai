"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconCircleCheck as CheckCircle2, IconCircleOff as CircleSlash } from "@tabler/icons-react";
import { Checkbox, NativeSelect } from "@mantine/core";
import { DateField } from "@/components/dates";
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
  original_currency: string | null;
  original_exchange_rate: number | null;
  operator_code?: string | null;
  cis_type?: string | null;
};

const sourceLabel: Record<string, string> = { connector: "CIS", import: "Import", manual: "Manuale" };
const typeLabel: Record<string, string> = { corrective: "Korrigjuese", cancelled: "Anuluar", summary: "Përmbledhëse" };
/** Shuma pa prapashtesën "LEK" për monedhën bazë (si cis-client-2); monedhat e tjera e mbajnë kodin. */
const amt = (v: number, cur: string, decimals: 0 | 2 = 2) => (cur === "ALL" ? money(v, cur, decimals).replace(/ LEK$/, "") : money(v, cur, decimals));

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
          <DateField label="Data e pagesës" size="xs" w={150} value={paidAt} onChange={(v) => v && setPaidAt(v)} />
          <NativeSelect
            label="Mënyra"
            size="xs"
            value={method}
            onChange={(e) => setMethod(e.currentTarget.value as typeof method)}
            data={[
              { value: "bank", label: "Bankë" },
              { value: "cash", label: "Cash" },
              { value: "card", label: "Kartë" },
              { value: "compensation", label: "Kompensim" },
              { value: "other", label: "Tjetër" },
            ]}
          />
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
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
            <tr>
              {canWrite && (
                <th className="w-8 px-3 py-2">
                  <Checkbox
                    size="xs"
                    aria-label="Zgjidh të gjitha"
                    checked={allSelected}
                    indeterminate={!allSelected && selected.size > 0}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((r) => r.id)))}
                  />
                </th>
              )}
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Numri</th>
              <th className="px-4 py-3">{direction === "sale" ? "Blerësi" : "Shitësi"}</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Lloji</th>
              <th className="px-4 py-3 text-right">Pa TVSH</th>
              <th className="px-4 py-3 text-right">TVSH</th>
              <th className="px-4 py-3 text-right">Totali</th>
              <th className="px-4 py-3">Pagesa</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cur = r.currency ?? currency;
              const isSel = selected.has(r.id);
              return (
                <tr
                  key={r.id}
                  className={`border-t border-border hover:bg-muted/50 ${canWrite ? "cursor-pointer" : ""} ${r.type === "cancelled" ? "opacity-50" : ""} ${isSel ? "bg-accent/10" : ""}`}
                  onClick={canWrite && r.type !== "cancelled" ? (e) => {
                    if ((e.target as HTMLElement).closest("a,button,input,.mantine-Checkbox-root")) return;
                    toggle(r.id);
                  } : undefined}
                >
                  {canWrite && (
                    <td className="px-3 py-2">
                      {r.type !== "cancelled" && <Checkbox size="xs" aria-label={`Zgjidh faturën ${r.number ?? ""}`} checked={isSel} onChange={() => toggle(r.id)} />}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-3 tabular">{date(r.issue_date)}</td>
                  <td
                    className="px-4 py-3"
                    title={[r.nivf && `NIVF ${r.nivf}`, r.nslf && `NSLF ${r.nslf}`, `Burimi: ${sourceLabel[r.source] ?? r.source}`].filter(Boolean).join(" · ")}
                  >
                    <div className="font-semibold">{r.number ?? "—"}</div>
                    {r.operator_code && <div className="font-mono text-[11px] text-muted-foreground">{r.operator_code}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {r.counterparty_name ?? "—"} {r.type !== "normal" && <Badge tone="warning" className="ml-1">{typeLabel[r.type] ?? r.type}</Badge>}
                    </div>
                    {r.counterparty_nipt && <div className="font-mono text-[11px] text-muted-foreground">{r.counterparty_nipt}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.cis_type === "CASH" ? <Badge>Me para në dorë</Badge> : r.cis_type === "NONCASH" ? <Badge tone="info">Pa para në dorë</Badge> : null}
                      {r.is_einvoice && <Badge tone="info" className="bg-violet-500/15 text-violet-500">E-faturë</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular">{amt(r.subtotal, cur)}</td>
                  <td className="px-4 py-3 text-right tabular">{amt(r.vat_amount, cur)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular">
                    {amt(r.total, cur)}
                    {r.original_currency && r.original_exchange_rate ? (
                      <div className="text-[11px] font-normal text-muted-foreground" title={`Kursi ${r.original_exchange_rate}`}>
                        {money(Number(r.total) / Number(r.original_exchange_rate), r.original_currency.trim())}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={r.payment_status === "paid" ? "success" : r.payment_status === "partial" ? "warning" : "danger"}>
                      {r.payment_status === "paid" ? "E paguar" : r.payment_status === "partial" ? "Pjesërisht" : "E papaguar"}
                    </Badge>
                    {r.payment_status === "paid" && r.paid_at && <div className="mt-0.5 text-[11px] text-muted-foreground">{date(r.paid_at)}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-border bg-muted/50 text-xs font-medium">
            <tr>
              <td className="px-4 py-2" colSpan={canWrite ? 5 : 4}>
                Totali ({active.length} fatura{rows.length !== active.length ? `, ${rows.length - active.length} të anuluara` : ""})
              </td>
              <td className="px-4 py-2 text-right tabular">{amt(sum("subtotal"), currency)}</td>
              <td className="px-4 py-2 text-right tabular">{amt(sum("vat_amount"), currency)}</td>
              <td className="px-4 py-2 text-right tabular">{amt(sum("total"), currency)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </Card>
      {canWrite && <p className="text-xs text-muted-foreground">Kliko rreshtat (ose kutitë) për t&apos;i zgjedhur, pastaj shëno pagesën me datë dhe mënyrë.</p>}
    </div>
  );
}
