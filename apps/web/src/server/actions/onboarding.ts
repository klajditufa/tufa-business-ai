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
