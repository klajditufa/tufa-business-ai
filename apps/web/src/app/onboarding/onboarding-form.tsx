"use client";

import { useActionState } from "react";
import { createFirstCompanyAction } from "@/server/actions/onboarding";
import type { ActionResult } from "@/server/actions/auth";
import { Alert, Button, Card, Input, Label, Select } from "@/components/ui";
import { t } from "@/lib/i18n";

export function OnboardingForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createFirstCompanyAction, null);
  const d = t();
  return (
    <form action={action} className="space-y-6">
      <Card className="space-y-4">
        <div>
          <Label>{d.onboarding.orgType}</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/10">
              <input type="radio" name="orgType" value="single" defaultChecked /> {d.onboarding.orgSingle}
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/10">
              <input type="radio" name="orgType" value="studio" /> {d.onboarding.orgStudio}
            </label>
          </div>
        </div>
        <div>
          <Label htmlFor="orgName">{d.onboarding.orgName}</Label>
          <Input id="orgName" name="orgName" required minLength={2} />
        </div>
      </Card>

      <Card className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="nipt">{d.onboarding.nipt}</Label>
          <Input id="nipt" name="nipt" placeholder="K12345678A" required pattern="[A-Za-z][0-9]{8}[A-Za-z]" className="uppercase" />
        </div>
        <div>
          <Label htmlFor="legal_form">{d.onboarding.legalForm}</Label>
          <Select id="legal_form" name="legal_form" defaultValue="shpk">
            {Object.entries(d.legalForms).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="legal_name">{d.onboarding.legalName}</Label>
          <Input id="legal_name" name="legal_name" required minLength={2} />
        </div>
        <div>
          <Label htmlFor="trade_name">{d.onboarding.tradeName}</Label>
          <Input id="trade_name" name="trade_name" />
        </div>
        <div>
          <Label htmlFor="administrator_name">{d.onboarding.administrator}</Label>
          <Input id="administrator_name" name="administrator_name" />
        </div>
        <div>
          <Label htmlFor="city">{d.onboarding.city}</Label>
          <Input id="city" name="city" />
        </div>
        <div>
          <Label htmlFor="address">{d.onboarding.address}</Label>
          <Input id="address" name="address" />
        </div>
        <div>
          <Label htmlFor="tax_regime">{d.onboarding.taxRegime}</Label>
          <Select id="tax_regime" name="tax_regime" defaultValue="standard">
            {Object.entries(d.taxRegimes).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="base_currency">{d.onboarding.currency}</Label>
          <Select id="base_currency" name="base_currency" defaultValue="ALL">
            <option value="ALL">LEK (ALL)</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="vat_registered" defaultChecked /> {d.onboarding.vatRegistered}
        </label>
      </Card>

      {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? d.common.loading : d.onboarding.submit}
      </Button>
    </form>
  );
}
