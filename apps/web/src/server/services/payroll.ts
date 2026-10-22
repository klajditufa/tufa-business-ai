import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Listëpagesat e importuara nga C@TS, nga më e reja; me numrin e rreshtave të detajeve për muaj. */
export async function listPayrollDeclarations(companyId: string) {
  const supabase = await createClient();
  const [{ data, error }, { data: lines }] = await Promise.all([
    supabase
      .from("payroll_declarations")
      .select("id, model, submitted_on, due_date, employees, gross, social, health, income_tax, cats_status, issh_status, issh_sent_on, imported_at, fiscal_periods(year, month)")
      .eq("company_id", companyId),
    supabase.from("payroll_declaration_lines").select("period_id, fiscal_periods(year, month)").eq("company_id", companyId),
  ]);
  const withLines = new Set((lines ?? []).map((l) => `${l.fiscal_periods?.year}-${l.fiscal_periods?.month}`));
  const rows = (data ?? [])
    .map((d) => ({ ...d, year: d.fiscal_periods?.year ?? 0, month: d.fiscal_periods?.month ?? 0 }))
    .map((d) => ({ ...d, hasLines: withLines.has(`${d.year}-${d.month}`) }))
    .sort((a, b) => b.year - a.year || b.month - a.month || (b.submitted_on ?? "").localeCompare(a.submitted_on ?? ""));
  return { rows, error };
}

export async function getPayrollLines(companyId: string, year: number, month: number) {
  const supabase = await createClient();
  const { data: period } = await supabase.from("fiscal_periods").select("id").eq("company_id", companyId).eq("year", year).eq("month", month).maybeSingle();
  if (!period) return { lines: [], declarations: [] };
  const [{ data: lines }, { data: declarations }] = await Promise.all([
    supabase.from("payroll_declaration_lines").select("*").eq("company_id", companyId).eq("period_id", period.id).order("full_name"),
    supabase.from("payroll_declarations").select("*").eq("company_id", companyId).eq("period_id", period.id).order("submitted_on", { ascending: false }),
  ]);
  return { lines: lines ?? [], declarations: declarations ?? [] };
}
