"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseCents } from "@/lib/payroll-calc";
import type { ActionResult } from "./auth";

/** Shuma → string me 2 dhjetore për numeric (pa float). Pranon "100000", "100,000.50", "100.000,50". */
const money = (label: string, optional = false) =>
  z
    .string()
    .trim()
    .transform((s, ctx) => {
      if (s === "" && optional) return "0.00";
      const c = parseCents(s);
      if (c === null) {
        ctx.addIssue({ code: "custom", message: `${label}: shumë e pavlefshme` });
        return z.NEVER;
      }
      return (c / 100).toFixed(2);
    });

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s || null);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data duhet në formatin VVVV-MM-DD");

const deny = (e: { code?: string; message: string }, what: string) => {
  if (e.code === "42501") return `Nuk ke të drejtë për ${what} e këtij subjekti.`;
  if (e.code === "23514") return "Kontrolli dështoi: shiko që minimumi referues të jetë rishikuar dhe që e dorëzuara të ketë numër protokolli.";
  if (e.code === "23505") return "Ky numër deklarate ekziston tashmë.";
  return e.message;
};

const firstIssue = (error: z.ZodError): ActionResult => {
  const issue = error.issues[0];
  return { ok: false, error: issue.message, field: String(issue.path[0] ?? "") };
};

// ---------------------------------------------------------------------------
// Tatimi në burim për qiranë
// ---------------------------------------------------------------------------

const rentSchema = z.object({
  companyId: z.string().uuid(),
  doc_date: isoDate,
  beneficiary_name: z.string().trim().min(2, "Emri i qiradhënësit mungon").max(200),
  beneficiary_id: text(40),
  property: text(300),
  gross: money("Qiraja bruto"),
  reference_minimum: money("Minimumi referues", true),
  rate: z.coerce.number().min(0).max(99.99),
  reference_reviewed: z.literal("on").optional(),
  notes: text(2000),
});

export async function saveRentAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = rentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstIssue(parsed.error);
  const { companyId, reference_reviewed, ...row } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("rent_withholdings")
    .insert({ ...row, company_id: companyId, gross: Number(row.gross), reference_minimum: Number(row.reference_minimum), reference_reviewed: !!reference_reviewed });
  if (error) return { ok: false, error: deny(error, "qiratë") };
  revalidatePath(`/app/${companyId}/tools/rent`);
  return { ok: true, message: "Qiraja u regjistrua." };
}

const statusSchema = z.object({
  companyId: z.string().uuid(),
  id: z.string().uuid(),
  status: z.enum(["draft", "reviewed", "submitted"]),
  receipt: z.string().trim().max(200).optional(),
});

export async function setRentStatusAction(input: z.input<typeof statusSchema>): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { companyId, id, status, receipt } = parsed.data;
  const supabase = await createClient();
  const patch: { status: string; reference_reviewed?: boolean; receipt?: string | null } = { status };
  if (status !== "draft") patch.reference_reviewed = true;
  if (receipt !== undefined) patch.receipt = receipt || null;
  const { error } = await supabase.from("rent_withholdings").update(patch).eq("id", id).eq("company_id", companyId);
  if (error) return { ok: false, error: deny(error, "qiratë") };
  revalidatePath(`/app/${companyId}/tools/rent`);
  return { ok: true };
}

export async function deleteRentAction(companyId: string, id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(companyId).success || !z.string().uuid().safeParse(id).success) return { ok: false, error: "Të dhëna të pavlefshme." };
  const supabase = await createClient();
  const { error } = await supabase.from("rent_withholdings").delete().eq("id", id).eq("company_id", companyId);
  if (error) return { ok: false, error: deny(error, "qiratë") };
  revalidatePath(`/app/${companyId}/tools/rent`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Deklaratat doganore
// ---------------------------------------------------------------------------

const customsSchema = z.object({
  companyId: z.string().uuid(),
  reference: z.string().trim().min(1, "Numri i deklaratës mungon").max(100),
  decl_date: isoDate,
  taxable_amount: money("Vlera e tatueshme"),
  import_vat: money("TVSH në import"),
  duty: money("Detyrimi doganor", true),
  invoice_fic: text(100),
  source_url: text(500).refine(
    (u) => u === null || /^https:\/\/(www\.)?(dogana\.gov\.al|tatime\.gov\.al|efiling\.tatime\.gov\.al)(\/|$)/.test(u),
    "Lidhja duhet të jetë https në dogana.gov.al ose tatime.gov.al",
  ),
  notes: text(2000),
});

export async function saveCustomsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = customsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstIssue(parsed.error);
  const { companyId, ...row } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("customs_declarations").insert({
    ...row,
    company_id: companyId,
    taxable_amount: Number(row.taxable_amount),
    import_vat: Number(row.import_vat),
    duty: Number(row.duty),
  });
  if (error) return { ok: false, error: deny(error, "doganat") };
  revalidatePath(`/app/${companyId}/tools/customs`);
  return { ok: true, message: "Deklarata doganore u regjistrua." };
}

export async function setCustomsStatusAction(companyId: string, id: string, status: "pending" | "reviewed"): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(companyId).success || !z.string().uuid().safeParse(id).success || !["pending", "reviewed"].includes(status)) {
    return { ok: false, error: "Të dhëna të pavlefshme." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("customs_declarations").update({ status }).eq("id", id).eq("company_id", companyId);
  if (error) return { ok: false, error: deny(error, "doganat") };
  revalidatePath(`/app/${companyId}/tools/customs`);
  return { ok: true };
}

export async function deleteCustomsAction(companyId: string, id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(companyId).success || !z.string().uuid().safeParse(id).success) return { ok: false, error: "Të dhëna të pavlefshme." };
  const supabase = await createClient();
  const { error } = await supabase.from("customs_declarations").delete().eq("id", id).eq("company_id", companyId);
  if (error) return { ok: false, error: deny(error, "doganat") };
  revalidatePath(`/app/${companyId}/tools/customs`);
  return { ok: true };
}
