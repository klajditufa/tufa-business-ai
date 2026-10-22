"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

const err = (e: { code?: string; message: string }) => (e.code === "42501" ? "Nuk ke të drejtë për listëpagesat e këtij subjekti." : e.message);

const summaryRow = z.object({
  year: z.number().int().min(2000).max(2100), month: z.number().int().min(1).max(12), model: z.string().max(80),
  submitted_on: z.string().nullable(), due_date: z.string().nullable(), employees: z.number(), gross: z.number(),
  social: z.number(), health: z.number(), income_tax: z.number(), cats_status: z.string().max(200).nullable(),
  issh_status: z.string().max(80).nullable(), issh_sent_on: z.string().nullable(),
});

export type ImportResult = { ok: boolean; error?: string; message?: string };

/** Importon përmbledhjen mujore ("Listëpagesa të Dorëzuara") nga C@TS. */
export async function importPayrollSummaryAction(companyId: string, rows: unknown[]): Promise<ImportResult> {
  const parsed = z.array(summaryRow).max(1000).safeParse(rows);
  if (!parsed.success || !z.string().uuid().safeParse(companyId).success) return { ok: false, error: "Të dhëna të pavlefshme." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_payroll_declarations", { p_company_id: companyId, p_rows: parsed.data as unknown as Json });
  if (error) return { ok: false, error: err(error) };
  const r = (data ?? {}) as { imported?: number; updated?: number; declarations_marked?: number };
  revalidatePath(`/app/${companyId}/payroll`);
  revalidatePath(`/app/${companyId}/declarations`);
  revalidatePath(`/app/${companyId}/dashboard`);
  return { ok: true, message: `${r.imported ?? 0} muaj të rinj, ${r.updated ?? 0} të përditësuar; ${r.declarations_marked ?? 0} deklarime E-SIG 025 u shënuan "deklaruar".` };
}

/** Importon rreshtat e punonjësve të një muaji ("Shfaq Detajet"). */
export async function importPayrollLinesAction(companyId: string, year: number, month: number, rows: unknown[]): Promise<ImportResult> {
  if (!z.string().uuid().safeParse(companyId).success || !Number.isInteger(year) || month < 1 || month > 12) return { ok: false, error: "Të dhëna të pavlefshme." };
  const ok = z.array(z.object({ nid: z.string().regex(/^[A-Z]\d{8}[A-Z]$/i) }).passthrough()).max(5000).safeParse(rows);
  if (!ok.success) return { ok: false, error: "Disa rreshta nuk kanë numër personal të vlefshëm." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_payroll_lines", { p_company_id: companyId, p_year: year, p_month: month, p_rows: rows as Json });
  if (error) return { ok: false, error: err(error) };
  revalidatePath(`/app/${companyId}/payroll`);
  return { ok: true, message: `${(data as { lines?: number })?.lines ?? 0} punonjës u importuan për ${String(month).padStart(2, "0")}/${year}.` };
}
