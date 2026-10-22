"use client";

import { useActionState, useState } from "react";
import { setVatOfficialAction } from "@/server/actions/vat";
import type { ActionResult } from "@/server/actions/auth";
import { Alert, Button, Input, Label } from "@/components/ui";

type Official = { output_vat?: number; input_vat?: number; payable?: number; credit_cf?: number; note?: string };

/** Forma për vlerat e deklaruara në C@TS (vetëm për kontabilistin / rolet me declarations.write). */
export function VatOfficialForm({ companyId, year, month, official }: { companyId: string; year: number; month: number; official: Official }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(setVatOfficialAction, null);
  const hasValues = ["output_vat", "input_vat", "payable", "credit_cf"].some((k) => official[k as keyof Official] != null);
  const [open, setOpen] = useState(!hasValues);
  const fmt = (v?: number) => (v == null ? "" : String(v));

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Ndrysho vlerat zyrtare
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      <div className="grid gap-3 sm:grid-cols-4">
        {(
          [
            ["output_vat", "TVSH e shitjeve"],
            ["input_vat", "TVSH e blerjeve"],
            ["payable", "TVSH për pagesë"],
            ["credit_cf", "Kredi për t'u mbartur"],
          ] as const
        ).map(([name, label]) => (
          <div key={name}>
            <Label htmlFor={`off-${name}`}>{label}</Label>
            <Input id={`off-${name}`} name={name} inputMode="decimal" placeholder="0,00" defaultValue={fmt(official[name])} />
          </div>
        ))}
      </div>
      <div>
        <Label htmlFor="off-note">Shënim</Label>
        <Input id="off-note" name="note" maxLength={500} placeholder="p.sh. sipas deklaratës në C@TS, nr. protokolli…" defaultValue={official.note ?? ""} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Duke ruajtur…" : "Ruaj vlerat zyrtare"}</Button>
        {hasValues && (
          <Button type="submit" name="clear" value="1" variant="ghost" disabled={pending}>
            Fshi vlerat zyrtare
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Plotëso vetëm atë që ke në deklaratën e C@TS. &quot;Kredi për t&apos;u mbartur&quot; përdoret si kredi hyrëse e muajit tjetër në vend të llogaritjes së sistemit.
      </p>
      {state && (state.ok ? <Alert tone="success">{state.message}</Alert> : <Alert tone="danger">{state.error}</Alert>)}
    </form>
  );
}
