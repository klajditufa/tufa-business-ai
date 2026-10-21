"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { companySchema } from "@/lib/schemas/company";
import type { ActionResult } from "./auth";

const editSchema = companySchema.omit({ orgType: true, orgName: true, nipt: true }).extend({
  companyId: z.string().uuid(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  nace_code: z.string().max(20).optional().or(z.literal("")),
  activity: z.string().max(300).optional().or(z.literal("")),
  fiscal_year_start: z.coerce.number().int().min(1).max(12).default(1),
});

export async function updateCompanyAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = editSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `${String(issue.path[0])}: ${issue.message}`, field: String(issue.path[0]) };
  }
  const { companyId, ...c } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({
      legal_name: c.legal_name,
      trade_name: c.trade_name || null,
      legal_form: c.legal_form,
      administrator_name: c.administrator_name || null,
      city: c.city || null,
      address: c.address || null,
      tax_regime: c.tax_regime,
      vat_registered: c.vat_registered,
      base_currency: c.base_currency,
      email: c.email || null,
      phone: c.phone || null,
      nace_code: c.nace_code || null,
      activity: c.activity || null,
      fiscal_year_start: c.fiscal_year_start,
    })
    .eq("id", companyId);
  if (error) return { ok: false, error: error.code === "42501" ? "Nuk ke të drejtë të ndryshosh subjektin." : error.message };
  revalidatePath(`/app/${companyId}/settings`);
  return { ok: true, message: "Të dhënat u ruajtën." };
}

const inviteSchema = z.object({
  companyId: z.string().uuid(),
  email: z.string().email("Email i pavlefshëm"),
  role: z.enum(["accountant", "company_admin", "finance_manager", "operator", "viewer"]),
});

export async function inviteUserAction(_prev: (ActionResult & { link?: string }) | null, formData: FormData): Promise<ActionResult & { link?: string }> {
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message, field: String(parsed.error.issues[0].path[0]) };
  const { companyId, email, role } = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("invitations")
    .insert({ company_id: companyId, email, company_role: role, invited_by: user?.id })
    .select("token")
    .single();
  if (error) return { ok: false, error: error.code === "42501" ? "Nuk ke të drejtë të ftosh përdorues." : error.message };
  const origin = (await headers()).get("origin") ?? "";
  revalidatePath(`/app/${companyId}/settings`);
  // Faza 1: linku dërgohet nga ftuesi (WhatsApp/email). Faza 2: email automatik.
  return { ok: true, message: "Ftesa u krijua. Dërgoja linkun personit.", link: `${origin}/invite/${data.token}` };
}

export async function revokeInvitationAction(id: string, companyId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/${companyId}/settings`);
  return { ok: true };
}

export async function removeMemberAction(companyId: string, userId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id === userId) return { ok: false, error: "Nuk mund ta heqësh veten." };
  const { error } = await supabase.from("company_memberships").delete().eq("company_id", companyId).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/${companyId}/settings`);
  return { ok: true };
}

export async function acceptInvitationAction(token: string): Promise<ActionResult & { companyId?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { ok: false, error: error.message };
  const r = data as { ok: boolean; error?: string; company_id?: string };
  if (!r.ok) {
    const msgs: Record<string, string> = {
      invalid: "Ftesa nuk ekziston.",
      used: "Kjo ftesë është përdorur tashmë.",
      expired: "Ftesa ka skaduar (7 ditë). Kërko një të re.",
      email_mismatch: "Ftesa është për një email tjetër. Hyr me atë email.",
    };
    return { ok: false, error: msgs[r.error ?? ""] ?? "Ftesa nuk u pranua." };
  }
  return { ok: true, companyId: r.company_id };
}
