import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { getCompany } from "@/server/services/companies";
import { getSyncStatus, listInvoices, parseInvoiceFilters } from "@/server/services/invoices";
import { Badge, Card, Empty } from "@/components/ui";
import { date, money } from "@/lib/format";
import { t } from "@/lib/i18n";
import { InvoiceFilterBar } from "./filters";

/**
 * Regjistri i shitjeve / blerjeve: filtra (periudhë, kërkim, status, burim), totale, burimi i çdo fature dhe statusi i sinkronizimit CIS.
 */
export default async function InvoicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { companyId } = await params;
  const f = parseInvoiceFilters(await searchParams);
  const d = t();
  const basePath = `/app/${companyId}/invoices`;
  const [company, { data: rows, error }, sync] = await Promise.all([getCompany(companyId), listInvoices(companyId, f), getSyncStatus(companyId)]);
  const currency = company?.base_currency ?? "ALL";
  const list = rows ?? [];
  const active = list.filter((r) => r.type !== "cancelled");
  const sum = (k: "subtotal" | "vat_amount" | "total") => active.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const unpaid = active.filter((r) => r.payment_status !== "paid").reduce((a, r) => a + Number(r.total), 0);

  const sourceLabel = { connector: "CIS", import: "Import", manual: "Manuale" } as const;
  const typeLabel: Record<string, string> = { corrective: "Korrigjuese", cancelled: "Anuluar", summary: "Përmbledhëse" };

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{f.direction === "sale" ? d.nav.sales : d.nav.purchases}</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5" />
          {sync?.last_sync_at ? (
            <span>Sinkronizuar nga fiskalizimi: {date(sync.last_sync_at)} · {sync.sales_count} shitje, {sync.purchases_count} blerje</span>
          ) : (
            <span>
              Pa sinkronizim ende — <Link href={`/app/${companyId}/settings#sync`} className="underline">lidh TUFA Sync</Link>
            </span>
          )}
        </div>
      </div>

      <InvoiceFilterBar basePath={basePath} f={f} />

      {error && <p className="text-sm text-danger">{error.message}</p>}

      {list.length === 0 ? (
        <Empty
          title="Asnjë faturë për këta filtra."
          hint={sync?.last_sync_at ? "Provo një periudhë tjetër ose hiq filtrat." : "Faturat vijnë automatikisht nga fiskalizimi (CIS) pasi të lidhësh agjentin TUFA Sync te Cilësimet."}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="p-3"><div className="text-xs text-muted-foreground">Fatura</div><div className="text-lg font-semibold tabular">{active.length}</div></Card>
            <Card className="p-3"><div className="text-xs text-muted-foreground">Pa TVSH</div><div className="text-lg font-semibold tabular">{money(sum("subtotal"), currency)}</div></Card>
            <Card className="p-3"><div className="text-xs text-muted-foreground">TVSH</div><div className="text-lg font-semibold tabular">{money(sum("vat_amount"), currency)}</div></Card>
            <Card className="p-3"><div className="text-xs text-muted-foreground">Totali · të papaguara</div><div className="text-lg font-semibold tabular">{money(sum("total"), currency)}<span className="ml-1 text-xs font-normal text-muted-foreground">/ {money(unpaid, currency, 0)}</span></div></Card>
          </div>

          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Data</th>
                  <th className="px-4 py-2">Nr.</th>
                  <th className="px-4 py-2">{f.direction === "sale" ? "Klienti" : "Furnitori"}</th>
                  <th className="px-4 py-2 text-right">Pa TVSH</th>
                  <th className="px-4 py-2 text-right">TVSH</th>
                  <th className="px-4 py-2 text-right">Totali</th>
                  <th className="px-4 py-2">Pagesa</th>
                  <th className="px-4 py-2">Burimi</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className={`border-t border-border ${r.type === "cancelled" ? "opacity-50" : ""}`}>
                    <td className="px-4 py-2 tabular whitespace-nowrap">{date(r.issue_date)}</td>
                    <td className="px-4 py-2 font-mono text-xs" title={r.nivf ? `NIVF ${r.nivf}${r.nslf ? ` · NSLF ${r.nslf}` : ""}` : undefined}>
                      {r.number ?? "—"}
                      {r.is_einvoice && <span className="ml-1 rounded bg-muted px-1 text-[10px]">e-F</span>}
                    </td>
                    <td className="px-4 py-2">
                      <div>{r.counterparty_name ?? "—"} {r.type !== "normal" && <Badge tone="warning" className="ml-1">{typeLabel[r.type] ?? r.type}</Badge>}</div>
                      {r.counterparty_nipt && <div className="font-mono text-[11px] text-muted-foreground">{r.counterparty_nipt}</div>}
                    </td>
                    <td className="px-4 py-2 text-right tabular">{money(r.subtotal, r.currency ?? currency)}</td>
                    <td className="px-4 py-2 text-right tabular">{money(r.vat_amount, r.currency ?? currency)}</td>
                    <td className="px-4 py-2 text-right tabular font-medium">{money(r.total, r.currency ?? currency)}</td>
                    <td className="px-4 py-2">
                      <Badge tone={r.payment_status === "paid" ? "success" : r.payment_status === "partial" ? "warning" : "danger"}>
                        {r.payment_status === "paid" ? "E paguar" : r.payment_status === "partial" ? "Pjesërisht" : "E papaguar"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone={r.source === "connector" ? "info" : "neutral"}>{sourceLabel[r.source] ?? r.source}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-border bg-muted/50 text-xs font-medium">
                <tr>
                  <td className="px-4 py-2" colSpan={3}>Totali ({active.length} fatura{list.length !== active.length ? `, ${list.length - active.length} të anuluara` : ""})</td>
                  <td className="px-4 py-2 text-right tabular">{money(sum("subtotal"), currency)}</td>
                  <td className="px-4 py-2 text-right tabular">{money(sum("vat_amount"), currency)}</td>
                  <td className="px-4 py-2 text-right tabular">{money(sum("total"), currency)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </Card>
          {list.length >= 1000 && <p className="text-xs text-muted-foreground">Shfaqen 1000 faturat e para — ngushto periudhën ose shkarko CSV-në.</p>}
        </>
      )}
    </div>
  );
}
