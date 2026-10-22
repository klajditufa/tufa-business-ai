"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./auth";

const err = (e: { code?: string; message: string }) => (e.code === "42501" ? "Nuk ke të drejtë për këtë veprim." : e.message);
const path = (companyId: string) => `/app/${companyId}/payroll`;

export async function generatePayrollAction(companyId: string, year: number, month: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("generate_payroll", { p_company_id: companyId, p_year: year, p_month: month });
  if (error) return { ok: false, error: err(error) };
  revalidatePath(path(companyId));
  return { ok: true, message: "Listëpagesa u përgatit nga punonjësit aktivë." };
}

export async function updatePayrollLineAction(companyId: string, lineId: string, gross: number, days: number): Promise<ActionResult> {
  if (!Number.isFinite(gross) || gross < 0 || !Number.isInteger(days) || days < 0 || days > 31) return { ok: false, error: "Vlera të pavlefshme." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_payroll_line", { p_line_id: lineId, p_gross: gross, p_days: days });
  if (error) return { ok: false, error: err(error) };
  revalidatePath(path(companyId));
  return { ok: true };
}

export async function removePayrollLineAction(companyId: string, lineId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_payroll_line", { p_line_id: lineId });
  if (error) return { ok: false, error: err(error) };
  revalidatePath(path(companyId));
  return { ok: true };
}

export async function finalizePayrollAction(companyId: string, runId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("finalize_payroll", { p_run_id: runId });
  if (error) return { ok: false, error: err(error) };
  revalidatePath(path(companyId));
  revalidatePath(`/app/${companyId}/dashboard`);
  return { ok: true, message: "Listëpagesa u finalizua; detyrimet u shtuan në panel." };
}

export async function reopenPayrollAction(companyId: string, runId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_payroll", { p_run_id: runId });
  if (error) return { ok: false, error: err(error) };
  revalidatePath(path(companyId));
  revalidatePath(`/app/${companyId}/dashboard`);
  return { ok: true, message: "Listëpagesa u rihap." };
}

const employeeSchema = z.object({
  companyId: z.string().uuid(),
  id: z.string().uuid().optional().or(z.literal("")),
  kind: z.enum(["employee", "owner"]).default("employee"),
  first_name: z.string().trim().min(1, "Emri mungon").max(80),
  last_name: z.string().trim().min(1, "Mbiemri mungon").max(80),
  personal_no: z.string().trim().max(20).regex(/^([A-Za-z]\d{8}[A-Za-z])?$/, "Nr. personal në formatin J12345678A").optional().or(z.literal("")),
  position: z.string().trim().max(120).optional().or(z.literal("")),
  gross_salary: z.coerce.number().min(0).max(100_000_000),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data e fillimit mungon"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

/** Shton ose përditëson një punonjës (RLS: payroll.write). */
export async function saveEmployeeAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = employeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: i.message, field: String(i.path[0]) };
  }
  const { companyId, id, ...e } = parsed.data;
  const row = {
    company_id: companyId,
    kind: e.kind,
    first_name: e.first_name,
    last_name: e.last_name,
    personal_no: e.personal_no ? e.personal_no.toUpperCase() : null,
    position: e.position || null,
    gross_salary: e.gross_salary,
    start_date: e.start_date,
    end_date: e.end_date || null,
  };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("employees").update(row).eq("id", id).eq("company_id", companyId) : await supabase.from("employees").insert(row);
  if (error) return { ok: false, error: error.code === "23505" ? "Ky nr. personal është regjistruar tashmë." : err(error) };
  revalidatePath(`${path(companyId)}/employees`);
  return { ok: true, message: id ? "Punonjësi u përditësua." : "Punonjësi u shtua." };
}
