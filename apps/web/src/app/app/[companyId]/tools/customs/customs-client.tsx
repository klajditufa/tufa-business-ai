"use client";

import { DateField } from "@/components/dates";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconTrash as Trash2 } from "@tabler/icons-react";
import { deleteCustomsAction, saveCustomsAction, setCustomsStatusAction } from "@/server/actions/tools";
import type { ActionResult } from "@/server/actions/auth";
import { Alert, Badge, Button, Card, Input, Label } from "@/components/ui";
import { formatCents } from "@/lib/payroll-calc";

export type CustomsRow = {
  id: string; reference: string; decl_date: string; taxable_amount: number; import_vat: number; duty: number;
  invoice_fic: string | null; status: string; notes: string | null; source_url: string | null;
  invoice_id: string | null; invoice_number: string | null; invoice_date: string | null; invoice_supplier: string | null;
  invoice_base: number | null; invoice_vat: number | null; match_by: string | null; vat_difference: number | null;
};

const lek = (n: number | null) => (n == null ? "—" : formatCents(Math.round(Number(n) * 100)));
const dmy = (d: string | null) => (d ? d.split("-").reverse().join(".") : "—");

export function CustomsForm({ companyId, defaultDate }: { companyId: string; defaultDate: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveCustomsAction, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <Card>
      <form ref={form} action={action} className="space-y-4">
        <input type="hidden" name="companyId" value={companyId} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="c-ref">Nr. i deklaratës (DAV)</Label>
            <Input id="c-ref" name="reference" required maxLength={100} />
          </div>
          <div>
            <Label htmlFor="c-date">Data</Label>
            <DateField id="c-date" name="decl_date" defaultValue={defaultDate} required />
          </div>
          <div>
            <Label htmlFor="c-base">Vlera e tatueshme (ALL)</Label>
            <Input id="c-base" name="taxable_amount" inputMode="decimal" required />
          </div>
          <div>
            <Label htmlFor="c-vat">TVSH në import (ALL)</Label>
            <Input id="c-vat" name="import_vat" inputMode="decimal" required />
          </div>
          <div>
            <Label htmlFor="c-duty">Detyrimi doganor (ALL)</Label>
            <Input id="c-duty" name="duty" inputMode="decimal" placeholder="0" />
          </div>
          <div>
            <Label htmlFor="c-fic">NIVF i faturës (opsional)</Label>
            <Input id="c-fic" name="invoice_fic" maxLength={100} placeholder="Përndryshe kërkohet me numrin" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Label htmlFor="c-url">Lidhja zyrtare (opsional)</Label>
            <Input id="c-url" name="source_url" type="url" maxLength={500} placeholder="https://dogana.gov.al/…" />
          </div>
        </div>
        <Button type="submit" disabled={pending}>{pending ? "Duke ruajtur…" : "Shto deklaratën"}</Button>
        {state && (state.ok ? <Alert tone="success">{state.message}</Alert> : <Alert tone="danger">{state.error}</Alert>)}
      </form>
    </Card>
  );
}

export function CustomsTable({ companyId, rows, canWrite }: { companyId: string; rows: CustomsRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : r.error);
      router.refresh();
    });
  return (
    <div className="space-y-2">
      {error && <Alert tone="danger">{error}</Alert>}
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Deklarata</th>
              <th className="px-3 py-2 text-right">Vlera</th>
              <th className="px-3 py-2 text-right">TVSH import</th>
              <th className="px-3 py-2 text-right">Doganë</th>
              <th className="px-3 py-2">Fatura e blerjes (CIS)</th>
              <th className="px-3 py-2 text-right">TVSH faturë</th>
              <th className="px-3 py-2 text-right">Diferenca</th>
              <th className="px-3 py-2">Statusi</th>
              {canWrite && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const diff = r.vat_difference == null ? null : Number(r.vat_difference);
              return (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">
                      {r.source_url ? <a href={r.source_url} target="_blank" rel="noreferrer" className="hover:underline">{r.reference}</a> : r.reference}
                    </div>
                    <div className="text-xs text-muted-foreground tabular">{dmy(r.decl_date)}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular">{lek(r.taxable_amount)}</td>
                  <td className="px-3 py-2 text-right tabular">{lek(r.import_vat)}</td>
                  <td className="px-3 py-2 text-right tabular">{lek(r.duty)}</td>
                  <td className="px-3 py-2">
                    {r.invoice_id ? (
                      <>
                        <div>{r.invoice_number ?? "pa numër"} · {dmy(r.invoice_date)}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.invoice_supplier} · {r.match_by === "fic" ? "sipas NIVF" : "sipas numrit"}
                        </div>
                      </>
                    ) : (
                      <span className="text-warning">Nuk u gjet</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular">{lek(r.invoice_vat)}</td>
                  <td className={`px-3 py-2 text-right tabular ${diff == null ? "" : Math.abs(diff) < 0.01 ? "text-success" : "text-warning"}`}>
                    {diff == null ? "—" : Math.abs(diff) < 0.01 ? "✓" : lek(diff)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={r.status === "reviewed" ? "success" : "neutral"}>{r.status === "reviewed" ? "Rishikuar" : "Në pritje"}</Badge>
                  </td>
                  {canWrite && (
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setCustomsStatusAction(companyId, r.id, r.status === "reviewed" ? "pending" : "reviewed"))}>
                        {r.status === "reviewed" ? "Rihap" : "Rishikuar"}
                      </Button>
                      <Button size="sm" variant="ghost" aria-label="Fshi" disabled={pending} onClick={() => confirm(`Fshi deklaratën ${r.reference}?`) && run(() => deleteCustomsAction(companyId, r.id))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
