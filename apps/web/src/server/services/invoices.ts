import "server-only";
import { createClient } from "@/lib/supabase/server";

export type InvoiceFilters = {
  direction: "sale" | "purchase";
  period?: string | null;      // YYYY-MM ose "all"
  q?: string | null;           // emër pale, NIPT, numër, NIVF
  status?: "paid" | "unpaid" | "partial" | "all" | null;
  source?: "connector" | "manual" | "import" | "all" | null;
};

export const INVOICE_COLUMNS =
  "id, number, nivf, nslf, eic, issue_date, due_date, counterparty_name, counterparty_nipt, subtotal, vat_amount, total, currency, type, payment_status, payment_method, source, is_einvoice, vat_breakdown, synced_at, paid_amount, paid_at";

/** Normalizon parametrat e URL-së në filtra; default: muaji i kaluar nuk vendoset — "all" tregon gjithçka. */
export function parseInvoiceFilters(sp: Record<string, string | undefined>): InvoiceFilters {
  const period = sp.period && /^\d{4}-\d{2}$/.test(sp.period) ? sp.period : sp.period === "all" ? "all" : currentMonth();
  return {
    direction: sp.direction === "purchase" ? "purchase" : "sale",
    period,
    q: (sp.q ?? "").trim().slice(0, 80) || null,
    status: (["paid", "unpaid", "partial"] as const).find((s) => s === sp.status) ?? "all",
    source: (["connector", "manual", "import"] as const).find((s) => s === sp.source) ?? "all",
  };
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function periodBounds(period: string) {
  const [y, m] = period.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(y, m, 0));
  const to = `${y}-${String(m).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`;
  return { from, to };
}

/** Lista e faturave sipas filtrave (RLS aktive). Kufi 1000 rreshta për UI; eksporti përdor të njëjtin query pa kufi të ulët. */
export async function listInvoices(companyId: string, f: InvoiceFilters, limit = 1000) {
  const supabase = await createClient();
  let q = supabase
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .eq("company_id", companyId)
    .eq("direction", f.direction)
    .is("deleted_at", null)
    .order("issue_date", { ascending: false })
    .order("number", { ascending: false })
    .limit(limit);
  if (f.period && f.period !== "all") {
    const { from, to } = periodBounds(f.period);
    q = q.gte("issue_date", from).lte("issue_date", to);
  }
  if (f.status && f.status !== "all") q = q.eq("payment_status", f.status);
  if (f.source && f.source !== "all") q = q.eq("source", f.source);
  if (f.q) {
    const term = f.q.replace(/[%,()]/g, " ").trim();
    q = q.or(`counterparty_name.ilike.%${term}%,counterparty_nipt.ilike.%${term}%,number.ilike.%${term}%,nivf.ilike.%${term}%`);
  }
  return q;
}

export async function getSyncStatus(companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("invoice_sync_status", { p_company_id: companyId });
  return data?.[0] ?? null;
}
