"use client";

import { useActionState } from "react";
import { updateCompanyAction } from "@/server/actions/settings";
import type { ActionResult } from "@/server/actions/auth";
import type { Company } from "@/server/services/companies";
import { Alert, Button, Input, Label, Select } from "@/components/ui";
import { t } from "@/lib/i18n";

export function CompanyEditForm({ company, canEdit }: { company: Company; canEdit: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateCompanyAction, null);
  const d = t();
  const ro = !canEdit;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="companyId" value={company.id} />
      <fieldset disabled={ro} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label htmlFor="legal_name">{d.onboarding.legalName}</Label><Input id="legal_name" name="legal_name" defaultValue={company.legal_name} required /></div>
        <div><Label htmlFor="trade_name">{d.onboarding.tradeName}</Label><Input id="trade_name" name="trade_name" defaultValue={company.trade_name ?? ""} /></div>
        <div><Label htmlFor="legal_form">{d.onboarding.legalForm}</Label>
          <Select id="legal_form" name="legal_form" defaultValue={company.legal_form}>{Object.entries(d.legalForms).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
        <div><Label htmlFor="administrator_name">{d.onboarding.administrator}</Label><Input id="administrator_name" name="administrator_name" defaultValue={company.administrator_name ?? ""} /></div>
        <div><Label htmlFor="city">{d.onboarding.city}</Label><Input id="city" name="city" defaultValue={company.city ?? ""} /></div>
        <div className="sm:col-span-2"><Label htmlFor="address">{d.onboarding.address}</Label><Input id="address" name="address" defaultValue={company.address ?? ""} /></div>
        <div><Label htmlFor="email">Email i subjektit</Label><Input id="email" name="email" type="email" defaultValue={company.email ?? ""} /></div>
        <div><Label htmlFor="phone">Telefon</Label><Input id="phone" name="phone" defaultValue={company.phone ?? ""} /></div>
        <div><Label htmlFor="nace_code">Kodi NACE</Label><Input id="nace_code" name="nace_code" defaultValue={company.nace_code ?? ""} /></div>
        <div><Label htmlFor="activity">Aktiviteti</Label><Input id="activity" name="activity" defaultValue={company.activity ?? ""} /></div>
        <div><Label htmlFor="tax_regime">{d.onboarding.taxRegime}</Label>
          <Select id="tax_regime" name="tax_regime" defaultValue={company.tax_regime}>{Object.entries(d.taxRegimes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
        <div><Label htmlFor="base_currency">{d.onboarding.currency}</Label>
          <Select id="base_currency" name="base_currency" defaultValue={company.base_currency}><option value="ALL">LEK (ALL)</option><option value="EUR">EUR</option><option value="USD">USD</option></Select></div>
        <div><Label htmlFor="fiscal_year_start">Fillimi i vitit fiskal (muaji)</Label><Input id="fiscal_year_start" name="fiscal_year_start" type="number" min={1} max={12} defaultValue={company.fiscal_year_start} /></div>
        <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="vat_registered" defaultChecked={company.vat_registered} /> {d.onboarding.vatRegistered}</label>
      </fieldset>
      {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
      {state?.ok && <Alert tone="success">{state.message}</Alert>}
      {canEdit && <Button type="submit" disabled={pending}>{pending ? d.common.loading : d.common.save}</Button>}
    </form>
  );
}
