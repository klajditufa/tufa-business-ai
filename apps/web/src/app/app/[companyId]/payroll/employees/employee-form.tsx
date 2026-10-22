"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveEmployeeAction } from "@/server/actions/payroll";
import type { ActionResult } from "@/server/actions/auth";
import { Alert, Button, Input, Label, Select } from "@/components/ui";

export type Employee = {
  id: string; kind: string; first_name: string; last_name: string; personal_no: string | null; position: string | null;
  gross_salary: number; start_date: string; end_date: string | null;
};

/** Forma e punonjësit (e re ose ndryshim). */
export function EmployeeForm({ companyId, employee, onDone }: { companyId: string; employee?: Employee; onDone?: () => void }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveEmployeeAction, null);
  const [kind, setKind] = useState(employee?.kind ?? "employee");
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state?.ok) return;
    if (!employee) formRef.current?.reset(); // forma e re pastrohet pas shtimit
    onDone?.();
  }, [state, onDone, employee]);
  const k = employee?.id ?? "new";
  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="companyId" value={companyId} />
      {employee && <input type="hidden" name="id" value={employee.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <div><Label htmlFor={`${k}-fn`}>Emri</Label><Input id={`${k}-fn`} name="first_name" defaultValue={employee?.first_name} required /></div>
        <div><Label htmlFor={`${k}-ln`}>Mbiemri</Label><Input id={`${k}-ln`} name="last_name" defaultValue={employee?.last_name} required /></div>
        <div><Label htmlFor={`${k}-nid`}>Nr. personal (NID)</Label><Input id={`${k}-nid`} name="personal_no" placeholder="J12345678A" defaultValue={employee?.personal_no ?? ""} /></div>
        <div>
          <Label htmlFor={`${k}-kind`}>Lloji</Label>
          <Select id={`${k}-kind`} name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="employee">Punonjës</option>
            <option value="owner">Pronar i vetëpunësuar</option>
          </Select>
        </div>
        <div><Label htmlFor={`${k}-pos`}>Pozicioni</Label><Input id={`${k}-pos`} name="position" defaultValue={employee?.position ?? ""} /></div>
        <div>
          <Label htmlFor={`${k}-gross`}>{kind === "owner" ? "Paga e deklaruar (0 = paga minimale)" : "Paga bruto mujore"}</Label>
          <Input id={`${k}-gross`} name="gross_salary" type="number" min={0} step="1" defaultValue={employee?.gross_salary ?? ""} required />
        </div>
        <div><Label htmlFor={`${k}-start`}>Data e fillimit</Label><Input id={`${k}-start`} name="start_date" type="date" defaultValue={employee?.start_date} required /></div>
        <div><Label htmlFor={`${k}-end`}>Data e largimit</Label><Input id={`${k}-end`} name="end_date" type="date" defaultValue={employee?.end_date ?? ""} /></div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Duke ruajtur…" : employee ? "Ruaj ndryshimet" : "Shto punonjësin"}</Button>
        {employee && onDone && <Button type="button" size="sm" variant="ghost" onClick={onDone}>Anulo</Button>}
      </div>
      {state && (state.ok ? <Alert tone="success">{state.message}</Alert> : <Alert tone="danger">{state.error}</Alert>)}
    </form>
  );
}
