import "server-only";
import { createClient } from "@/lib/supabase/server";

export type MonthRow = {
  m: string; s_count: number; s_net: number; s_vat: number; s_total: number;
  p_count: number; p_net: number; p_vat: number; p_total: number;
};
export type TopParty = { party_id: string | null; name: string; nipt: string | null; invoices: number; net: number; total: number };
export type Threshold = { kind: string; code: string; amount: number | null; label: string | null; source: string | null; confirmed: boolean };
export type AnnualReport = {
  year: number;
  months: MonthRow[];
  totals: Omit<MonthRow, "m">;
  top_customers: TopParty[];
  top_suppliers: TopParty[];
  thresholds: Threshold[];
};

export async function getAnnualReport(companyId: string, year: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("annual_report", { p_company_id: companyId, p_year: year });
  return { report: (data ?? null) as unknown as AnnualReport | null, error };
}

/** Viti nga ?year=, i kufizuar në një interval të arsyeshëm; default viti aktual. */
export function parseYear(v?: string) {
  const y = Number(v);
  const now = new Date().getFullYear();
  return Number.isInteger(y) && y >= 2015 && y <= now + 1 ? y : now;
}
