import "server-only";
import { createClient } from "@/lib/supabase/server";

export type PayrollTotals = {
  employees?: number; gross?: number; social_employee?: number; social_employer?: number;
  health_employee?: number; health_employer?: number; income_tax?: number; net?: number; to_pay?: number;
};

/** Listëpagesa e muajit (nëse ekziston) me rreshtat dhe emrat e punonjësve. */
export async function getPayroll(companyId: string, year: number, month: number) {
  const supabase = await createClient();
  const { data: period } = await supabase.from("fiscal_periods").select("id").eq("company_id", companyId).eq("year", year).eq("month", month).maybeSingle();
  if (!period) return { run: null, lines: [] };
  const { data: run } = await supabase.from("payroll_runs").select("id, status, totals, finalized_at").eq("company_id", companyId).eq("period_id", period.id).maybeSingle();
  if (!run) return { run: null, lines: [] };
  const { data: lines } = await supabase
    .from("payroll_lines")
    .select("id, days_worked, gross, social_base, social_employee, social_employer, health_base, health_employee, health_employer, income_tax, net, employees(id, first_name, last_name, personal_no, kind, position)")
    .eq("run_id", run.id);
  const sorted = (lines ?? []).sort((a, b) => `${a.employees?.last_name} ${a.employees?.first_name}`.localeCompare(`${b.employees?.last_name} ${b.employees?.first_name}`));
  return { run: { ...run, totals: (run.totals ?? {}) as PayrollTotals }, lines: sorted };
}

export async function listEmployees(companyId: string) {
  const supabase = await createClient();
  return supabase.from("employees").select("*").eq("company_id", companyId).order("last_name").order("first_name");
}
