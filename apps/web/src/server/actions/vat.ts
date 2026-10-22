"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./auth";

/** Shuma në format shqip ("1.234,50") ose standard ("1234.50") → number; bosh → undefined. */
const amount = z
  .string()
  .trim()
  .transform((s) => (s === "" ? undefined : s.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")))
  .refine((s) => s === undefined || (/^\d+(\.\d{1,2})?$/.test(s)), "Shumë e pavlefshme")
  .optional();

const schema = z.object({
  companyId: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  output_vat: amount,
  input_vat: amount,
  payable: amount,
  credit_cf: amount,
  note: z.string().max(500).optional(),
  clear: z.string().optional(),
});

/** Regjistron (ose fshin) vlerat zyrtare të TVSH-së sipas C@TS për muajin. */
export async function setVatOfficialAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `${String(issue.path[0])}: ${issue.message}`, field: String(issue.path[0]) };
  }
  const { companyId, year, month, clear, ...v } = parsed.data;
  const values = clear ? {} : Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined && x !== ""));
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_vat_official", { p_company_id: companyId, p_year: year, p_month: month, p_values: values });
  if (error) return { ok: false, error: error.code === "42501" ? "Nuk ke të drejtë të regjistrosh vlerat zyrtare." : error.message };
  revalidatePath(`/app/${companyId}/vat`);
  return { ok: true, message: clear ? "Vlerat zyrtare u fshinë." : "Vlerat zyrtare u ruajtën." };
}
