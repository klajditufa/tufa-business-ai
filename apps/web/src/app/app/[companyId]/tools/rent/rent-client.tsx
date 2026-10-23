"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteRentAction, saveRentAction, setRentStatusAction } from "@/server/actions/tools";
import type { ActionResult } from "@/server/actions/auth";
import { Alert, Badge, Button, Card, Input, Label } from "@/components/ui";
import { formatCents, parseCents, rentWithholding } from "@/lib/payroll-calc";

export type RentRow = {
  id: string; doc_date: string; beneficiary_name: string; beneficiary_id: string | null; property: string | null;
  gross: number; reference_minimum: number; rate: number; tax_base: number; tax: number; status: string; receipt: string | null; notes: string | null;
};

const STATUS: Record<string, { label: string; tone: "neutral" | "info" | "success" }> = {
  draft: { label: "Draft", tone: "neutral" },
  reviewed: { label: "Rishikuar", tone: "info" },
  submitted: { label: "Deklaruar", tone: "success" },
};

const lek = (n: number) => formatCents(Math.round(Number(n) * 100));

export function RentForm({ companyId, defaultDate }: { companyId: string; defaultDate: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveRentAction, null);
  const form = useRef<HTMLFormElement>(null);
  const [gross, setGross] = useState("");
  const [minimum, setMinimum] = useState("");
  const [rate, setRate] = useState("15");
  // Pas ruajtjes së suksesshme: pastro fushat (gjendja gjatë render-it, forma në effect)
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) {
      setGross("");
      setMinimum("");
    }
  }
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  const g = parseCents(gross);
  const m = parseCents(minimum || "0");
  const preview = g !== null && m !== null && Number(rate) >= 0 && Number(rate) < 100 ? rentWithholding(g, m, Number(rate)) : null;

  return (
    <Card>
      <form ref={form} action={action} className="space-y-4">
        <input type="hidden" name="companyId" value={companyId} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="r-date">Data e pagesës</Label>
            <Input id="r-date" name="doc_date" type="date" defaultValue={defaultDate} required />
          </div>
          <div>
            <Label htmlFor="r-name">Qiradhënësi</Label>
            <Input id="r-name" name="beneficiary_name" required minLength={2} maxLength={200} placeholder="Emri ose subjekti" />
          </div>
          <div>
            <Label htmlFor="r-id">NIPT / nr. personal (opsional)</Label>
            <Input id="r-id" name="beneficiary_id" maxLength={40} />
          </div>
          <div>
            <Label htmlFor="r-gross">Qiraja bruto sipas kontratës (ALL)</Label>
            <Input id="r-gross" name="gross" inputMode="decimal" required value={gross} onChange={(e) => setGross(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="r-min">Minimumi referues (ALL)</Label>
            <Input id="r-min" name="reference_minimum" inputMode="decimal" value={minimum} onChange={(e) => setMinimum(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label htmlFor="r-rate">Norma (%)</Label>
            <Input id="r-rate" name="rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Label htmlFor="r-prop">Pasuria (opsional)</Label>
            <Input id="r-prop" name="property" maxLength={300} placeholder="p.sh. Dyqan, rr. ..., Durrës" />
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="reference_reviewed" className="mt-1" />
          <span>
            E kam kontrolluar minimumin referues të qirasë për këtë pasuri.
            <span className="block text-xs text-muted-foreground">Sistemi nuk e gjen vetë minimumin; pa këtë konfirmim regjistrimi mbetet draft.</span>
          </span>
        </label>
        {preview && (
          <div className="rounded-lg bg-muted px-4 py-3 text-sm tabular">
            Baza {formatCents(preview.base)} × {rate}% = <b>TAP {formatCents(preview.tax)}</b>
            {preview.net !== null && <> · neto për qiradhënësin {formatCents(preview.net)}</>}
            {preview.referenceAdjustment && <span className="block text-xs text-warning">Qiraja është nën minimumin referues: tatimi llogaritet mbi minimumin.</span>}
          </div>
        )}
        <Button type="submit" disabled={pending}>{pending ? "Duke ruajtur…" : "Shto qiranë"}</Button>
        {state && (state.ok ? <Alert tone="success">{state.message}</Alert> : <Alert tone="danger">{state.error}</Alert>)}
      </form>
    </Card>
  );
}

export function RentTable({ companyId, rows, canWrite }: { companyId: string; rows: RentRow[]; canWrite: boolean }) {
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
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Qiradhënësi</th>
              <th className="px-3 py-2 text-right">Qiraja</th>
              <th className="px-3 py-2 text-right">Minimumi</th>
              <th className="px-3 py-2 text-right">Baza</th>
              <th className="px-3 py-2 text-right">TAP</th>
              <th className="px-3 py-2">Statusi</th>
              {canWrite && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="whitespace-nowrap px-3 py-2 tabular">{r.doc_date.split("-").reverse().join(".")}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{r.beneficiary_name}</div>
                  <div className="text-xs text-muted-foreground">{[r.beneficiary_id, r.property].filter(Boolean).join(" · ")}</div>
                </td>
                <td className="px-3 py-2 text-right tabular">{lek(r.gross)}</td>
                <td className="px-3 py-2 text-right tabular">{lek(r.reference_minimum)}</td>
                <td className="px-3 py-2 text-right tabular">{lek(r.tax_base)}</td>
                <td className="px-3 py-2 text-right font-medium tabular">{lek(r.tax)}</td>
                <td className="px-3 py-2">
                  <Badge tone={STATUS[r.status]?.tone ?? "neutral"}>{STATUS[r.status]?.label ?? r.status}</Badge>
                  {r.receipt && <div className="mt-1 text-xs text-muted-foreground">Prot. {r.receipt}</div>}
                </td>
                {canWrite && (
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {r.status === "draft" && (
                      <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setRentStatusAction({ companyId, id: r.id, status: "reviewed" }))}>
                        Rishikuar
                      </Button>
                    )}
                    {r.status === "reviewed" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => {
                          const receipt = prompt("Numri i protokollit të deklarimit në C@TS:");
                          if (receipt) run(() => setRentStatusAction({ companyId, id: r.id, status: "submitted", receipt }));
                        }}
                      >
                        Deklaruar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Fshi"
                      disabled={pending}
                      onClick={() => confirm(`Fshi qiranë e ${r.beneficiary_name}?`) && run(() => deleteRentAction(companyId, r.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
