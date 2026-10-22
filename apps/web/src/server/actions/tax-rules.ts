"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type { ActionResult } from "./auth";

const idSchema = z.string().uuid();

const msg = (e: { code?: string; message: string }) =>
  e.code === "42501" ? "Vetëm administratori i platformës mund ta bëjë këtë." : e.message;

export async function confirmTaxRuleAction(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: "ID e pavlefshme" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_tax_rule", { p_id: id });
  if (error) return { ok: false, error: msg(error) };
  revalidatePath("/admin/tax-rules");
  return { ok: true, message: "U konfirmua." };
}

const editSchema = z.object({
  id: z.string().uuid(),
  mode: z.enum(["correct", "supersede"]),
  params: z.string().min(2),
  source: z.string().max(300).optional(),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

/** Korrigjim (gabim shtypi, pa histori) ose vlerë e re ligjore nga një datë (ruan historinë). */
export async function editTaxRuleAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = editSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Të dhëna të pavlefshme." };
  let params: Json;
  try {
    params = JSON.parse(parsed.data.params) as Json;
  } catch {
    return { ok: false, error: "Parametrat nuk janë JSON i vlefshëm." };
  }
  const supabase = await createClient();
  const { mode, id, source, validFrom } = parsed.data;
  const { error } =
    mode === "correct"
      ? await supabase.rpc("correct_tax_rule", { p_id: id, p_params: params, p_source: source || undefined })
      : await supabase.rpc("supersede_tax_rule", { p_id: id, p_params: params, p_valid_from: validFrom ?? "", p_source: source ?? "" });
  if (error) return { ok: false, error: msg(error) };
  revalidatePath("/admin/tax-rules");
  return { ok: true, message: mode === "correct" ? "Vlera u korrigjua dhe u konfirmua." : "Vlera e re u regjistrua nga data e zgjedhur." };
}
