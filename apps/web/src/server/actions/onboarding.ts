"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./auth";
import { companySchema } from "@/lib/schemas/company";

export async function createFirstCompanyAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `${String(issue.path[0])}: ${issue.message}`, field: String(issue.path[0]) };
  }
  const { orgType, orgName, ...company } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organization_with_company", {
    p_org_name: orgName,
    p_org_type: orgType,
    p_company: company,
  });
  if (error) {
    if (error.message.includes("companies_nipt_key")) return { ok: false, error: "Ky NIPT është regjistruar tashmë në platformë.", field: "nipt" };
    return { ok: false, error: error.message };
  }
  redirect(`/app/${data}/dashboard`);
}

/** Shton një subjekt tjetër në organizatën ku përdoruesi është owner (për studiot). */
export async function addCompanyAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = companySchema.omit({ orgType: true, orgName: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `${String(issue.path[0])}: ${issue.message}`, field: String(issue.path[0]) };
  }
  const supabase = await createClient();
  const { data: orgs } = await supabase.from("organization_memberships").select("organization_id").eq("role", "org_owner").limit(1);
  const orgId = orgs?.[0]?.organization_id;
  if (!orgId) return { ok: false, error: "Vetëm pronari i organizatës mund të shtojë subjekte." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const c = parsed.data;
  const { data, error } = await supabase
    .from("companies")
    .insert({
      organization_id: orgId,
      nipt: c.nipt,
      legal_name: c.legal_name,
      trade_name: c.trade_name || null,
      legal_form: c.legal_form,
      administrator_name: c.administrator_name || null,
      city: c.city || null,
      address: c.address || null,
      tax_regime: c.tax_regime,
      vat_registered: c.vat_registered,
      base_currency: c.base_currency,
      created_by: user?.id,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ky NIPT është regjistruar tashmë në platformë.", field: "nipt" };
    return { ok: false, error: error.message };
  }
  redirect(`/app/${data.id}/dashboard`);
}
