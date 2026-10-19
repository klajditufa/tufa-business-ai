import "server-only";
import { createClient } from "@/lib/supabase/server";
import { monthRange } from "@/lib/format";

/**
 * Të gjitha shifrat vijnë nga funksionet SQL (NUMERIC); këtu vetëm i kalojmë në UI.
 * Vlerat NUMERIC arrijnë si string nga PostgREST — nuk i konvertojmë për aritmetikë.
 */
export async function getDashboardData(companyId: string) {
  const supabase = await createClient();
  const { from, to } = monthRange();

  const [turnover, series, obligations, debtors, deadlines] = await Promise.all([
    supabase.rpc("company_turnover", { p_company_id: companyId, p_from: from, p_to: to }).single(),
    supabase.rpc("monthly_series", { p_company_id: companyId, p_months: 12 }),
    supabase.rpc("outstanding_obligations", { p_company_id: companyId }),
    supabase.rpc("top_debtors", { p_company_id: companyId, p_limit: 5 }),
    supabase.rpc("upcoming_deadlines", { p_company_id: companyId, p_days: 30 }),
  ]);

  return {
    period: { from, to },
    turnover: turnover.data ?? null,
    series: series.data ?? [],
    obligations: obligations.data ?? [],
    debtors: debtors.data ?? [],
    deadlines: deadlines.data ?? [],
    errors: [turnover.error, series.error, obligations.error, debtors.error, deadlines.error].filter(Boolean).map((e) => e!.message),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
