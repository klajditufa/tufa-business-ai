import "server-only";
import { createClient } from "@/lib/supabase/server";
import { buildLedger } from "@/lib/ledger";
export type { LedgerEntry } from "@/lib/ledger";

export type Direction = "sale" | "purchase";

/** Gjendja e të gjitha palëve (klientë për 'sale', furnitorë për 'purchase'). */
export async function listPartyBalances(companyId: string, direction: Direction) {
  const supabase = await createClient();
  return supabase.rpc("party_balances", { p_company_id: companyId, p_direction: direction });
}

/**
 * Kartela e palës: faturat (në datën e lëshimit) dhe pagesat (në datën e pagesës) në rend kronologjik,
 * me gjendje progresive. Për klientët gjendja pozitive = na detyrohet; për furnitorët = i detyrohemi.
 */
export async function getPartyLedger(companyId: string, direction: Direction, partyId: string) {
  const supabase = await createClient();
  const table = direction === "sale" ? "customers" : "suppliers";
  const fk = direction === "sale" ? "customer_id" : "supplier_id";
  const [{ data: party }, { data: invoices, error }] = await Promise.all([
    supabase.from(table).select("id, name, nipt, email, phone, address").eq("company_id", companyId).eq("id", partyId).maybeSingle(),
    supabase
      .from("invoices")
      .select("id, number, nivf, issue_date, due_date, total, paid_amount, paid_at, payment_status, payment_method, type, currency")
      .eq("company_id", companyId)
      .eq("direction", direction)
      .eq(fk, partyId)
      .is("deleted_at", null)
      .neq("type", "cancelled")
      .order("issue_date", { ascending: true }),
  ]);

  const entries = buildLedger(invoices ?? []);
  return { party, entries, invoices: invoices ?? [], error };
}

