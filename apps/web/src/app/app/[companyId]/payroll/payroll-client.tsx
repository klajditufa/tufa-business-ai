"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, RefreshCw, Trash2, Unlock } from "lucide-react";
import { finalizePayrollAction, generatePayrollAction, removePayrollLineAction, reopenPayrollAction, updatePayrollLineAction } from "@/server/actions/payroll";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { money } from "@/lib/format";

export type Line = {
  id: string; days_worked: number; gross: number; social_base: number; social_employee: number; social_employer: number;
  health_employee: number; health_employer: number; income_tax: number; net: number;
  name: string; personal_no: string | null; kind: string; position: string | null;
};

type Msg = { tone: "success" | "danger"; text: string } | null;

export function PayrollActions({ companyId, year, month, runId, status, canWrite, canApprove }: {
  companyId: string; year: number; month: number; runId: string | null; status: string | null; canWrite: boolean; canApprove: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? (r.message ? { tone: "success", text: r.message } : null) : { tone: "danger", text: r.error ?? "Gabim" });
      router.refresh();
    });
  return (
    <div className="space-y-2">
      <div className="no-print flex flex-wrap gap-2">
        {canWrite && status !== "final" && (
          <Button type="button" size="sm" disabled={pending} onClick={() => run(() => generatePayrollAction(companyId, year, month))}>
            <RefreshCw className="h-4 w-4" /> {runId ? "Rifresko nga punonjësit" : "Përgatit listëpagesën"}
          </Button>
        )}
        {canApprove && runId && status === "draft" && (
          <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => {
            if (confirm("Finalizon listëpagesën? Shumat shtohen si detyrime me afatin e deklarimit.")) run(() => finalizePayrollAction(companyId, runId));
          }}>
            <Lock className="h-4 w-4" /> Finalizo
          </Button>
        )}
        {canApprove && runId && status === "final" && (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(() => reopenPayrollAction(companyId, runId))}>
            <Unlock className="h-4 w-4" /> Rihap
          </Button>
        )}
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}

/** Tabela e listëpagesës; bruto dhe ditët ndryshohen direkt (ruhen kur del nga fusha). */
export function PayrollTable({ companyId, lines, editable }: { companyId: string; lines: Line[]; editable: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = (l: Line, gross: number, days: number) => {
    if (gross === Number(l.gross) && days === l.days_worked) return;
    start(async () => {
      const r = await updatePayrollLineAction(companyId, l.id, gross, days);
      setError(r.ok ? null : r.error);
      router.refresh();
    });
  };
  const sum = (k: keyof Line) => lines.reduce((a, l) => a + Number(l[k] ?? 0), 0);
  const cell = "px-2 py-2 text-right tabular";

  return (
    <div className="space-y-2">
      {error && <Alert tone="danger">{error}</Alert>}
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Punonjësi</th>
              <th className="px-2 py-2 text-right">Ditë</th>
              <th className="px-2 py-2 text-right">Paga bruto</th>
              <th className="px-2 py-2 text-right">Sig. shoq. punëmarrës</th>
              <th className="px-2 py-2 text-right">Sig. shoq. punëdhënës</th>
              <th className="px-2 py-2 text-right">Sig. shënd. punëm.</th>
              <th className="px-2 py-2 text-right">Sig. shënd. punëdh.</th>
              <th className="px-2 py-2 text-right">TAP</th>
              <th className="px-2 py-2 text-right">Paga neto</th>
              {editable && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="font-medium">{l.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-mono">{l.personal_no ?? "pa NID"}</span>
                    {l.kind === "owner" && <Badge tone="info" className="ml-1">pronar</Badge>}
                    {l.position && <> · {l.position}</>}
                  </div>
                </td>
                <td className={cell}>
                  {editable ? (
                    <input type="number" min={0} max={31} defaultValue={l.days_worked} className="h-8 w-14 rounded border border-border bg-background px-1 text-right"
                      onBlur={(e) => save(l, Number(l.gross), Number(e.target.value))} aria-label="Ditë pune" />
                  ) : l.days_worked}
                </td>
                <td className={cell}>
                  {editable ? (
                    <input type="number" min={0} step="1" defaultValue={Number(l.gross)} className="h-8 w-28 rounded border border-border bg-background px-1 text-right"
                      onBlur={(e) => save(l, Number(e.target.value), l.days_worked)} aria-label="Paga bruto" />
                  ) : money(l.gross, "ALL", 0)}
                  {Number(l.social_base) !== Number(l.gross) && <div className="text-[10px] text-muted-foreground">baza {money(l.social_base, "ALL", 0)}</div>}
                </td>
                <td className={cell}>{money(l.social_employee, "ALL", 0)}</td>
                <td className={cell}>{money(l.social_employer, "ALL", 0)}</td>
                <td className={cell}>{money(l.health_employee, "ALL", 0)}</td>
                <td className={cell}>{money(l.health_employer, "ALL", 0)}</td>
                <td className={cell}>{money(l.income_tax, "ALL", 0)}</td>
                <td className={`${cell} font-medium`}>{l.kind === "owner" ? "—" : money(l.net, "ALL", 0)}</td>
                {editable && (
                  <td className="px-2 py-2">
                    <button type="button" className="text-muted-foreground hover:text-danger" aria-label="Hiq nga listëpagesa" disabled={pending}
                      onClick={() => { if (confirm(`Heq ${l.name} nga listëpagesa e këtij muaji?`)) start(async () => { await removePayrollLineAction(companyId, l.id); router.refresh(); }); }}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-border bg-muted/50 text-xs font-medium">
            <tr>
              <td className="px-3 py-2">Totali ({lines.length})</td>
              <td />
              <td className={cell}>{money(sum("gross"), "ALL", 0)}</td>
              <td className={cell}>{money(sum("social_employee"), "ALL", 0)}</td>
              <td className={cell}>{money(sum("social_employer"), "ALL", 0)}</td>
              <td className={cell}>{money(sum("health_employee"), "ALL", 0)}</td>
              <td className={cell}>{money(sum("health_employer"), "ALL", 0)}</td>
              <td className={cell}>{money(sum("income_tax"), "ALL", 0)}</td>
              <td className={cell}>{money(sum("net"), "ALL", 0)}</td>
              {editable && <td />}
            </tr>
          </tfoot>
        </table>
      </Card>
      {editable && <p className="text-xs text-muted-foreground">Ndrysho pagën bruto ose ditët direkt në tabelë; kontributet dhe TAP rillogariten sapo del nga fusha.</p>}
    </div>
  );
}
