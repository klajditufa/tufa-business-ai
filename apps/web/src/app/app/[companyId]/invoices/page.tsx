import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/server/services/companies";
import { Badge, Card, Empty } from "@/components/ui";
import { date, money } from "@/lib/format";
import { t } from "@/lib/i18n";

/**
 * Regjistri i shitjeve/blerjeve — version bazë (lexim). Importi, filtrat e avancuar dhe eksporti vijnë në dorëzimet #5–#6.
 */
export default async function InvoicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ direction?: string }>;
}) {
  const { companyId } = await params;
  const { direction: dirParam } = await searchParams;
  const direction = dirParam === "purchase" ? "purchase" : "sale";
  const d = t();
  const supabase = await createClient();
  const [company, { data: rows, error }] = await Promise.all([
    getCompany(companyId),
    supabase
      .from("invoices")
      .select("id, number, nivf, issue_date, due_date, counterparty_name, subtotal, vat_amount, total, currency, type, payment_status, source")
      .eq("company_id", companyId)
      .eq("direction", direction)
      .is("deleted_at", null)
      .order("issue_date", { ascending: false })
      .limit(200),
  ]);
  const currency = company?.base_currency ?? "ALL";

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{direction === "sale" ? d.nav.sales : d.nav.purchases}</h1>
        <div className="flex gap-2 text-sm">
          <a href="?direction=sale" className={`rounded-lg px-3 py-1.5 ${direction === "sale" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>Shitjet</a>
          <a href="?direction=purchase" className={`rounded-lg px-3 py-1.5 ${direction === "purchase" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>Blerjet</a>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error.message}</p>}

      {!rows || rows.length === 0 ? (
        <Empty title="Ende pa fatura." hint="Importi nga Selfcare (Excel/CSV/XML) vjen në dorëzimin #5." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2">Nr.</th>
                <th className="px-4 py-2">{direction === "sale" ? "Klienti" : "Furnitori"}</th>
                <th className="px-4 py-2 text-right">Pa TVSH</th>
                <th className="px-4 py-2 text-right">TVSH</th>
                <th className="px-4 py-2 text-right">Totali</th>
                <th className="px-4 py-2">Statusi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2 tabular">{date(r.issue_date)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.number ?? r.nivf ?? "—"}</td>
                  <td className="px-4 py-2">{r.counterparty_name ?? "—"} {r.type !== "normal" && <Badge tone="warning" className="ml-1">{r.type}</Badge>}</td>
                  <td className="px-4 py-2 text-right tabular">{money(r.subtotal, r.currency ?? currency)}</td>
                  <td className="px-4 py-2 text-right tabular">{money(r.vat_amount, r.currency ?? currency)}</td>
                  <td className="px-4 py-2 text-right tabular font-medium">{money(r.total, r.currency ?? currency)}</td>
                  <td className="px-4 py-2">
                    <Badge tone={r.payment_status === "paid" ? "success" : r.payment_status === "partial" ? "warning" : "danger"}>
                      {r.payment_status === "paid" ? "E paguar" : r.payment_status === "partial" ? "Pjesërisht" : "E papaguar"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
