import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { getCompany } from "@/server/services/companies";
import { getSyncStatus, listInvoices, parseInvoiceFilters } from "@/server/services/invoices";
import { Card, Empty } from "@/components/ui";
import { date, money } from "@/lib/format";
import { t } from "@/lib/i18n";
import { InvoiceFilterBar } from "./filters";
import { InvoiceTable } from "./invoice-table";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const [company, { data: rows, error }, sync, { data: perms }] = await Promise.all([
    getCompany(companyId),
    listInvoices(companyId, f),
    getSyncStatus(companyId),
    supabase.rpc("my_permissions", { p_company_id: companyId }),
  ]);
  const canWrite = (perms ?? []).some((p) => p.module === "invoices" && p.action === "write");
  const currency = company?.base_currency ?? "ALL";
  const list = rows ?? [];
  const active = list.filter((r) => r.type !== "cancelled");
  const sum = (k: "subtotal" | "vat_amount" | "total") => active.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const unpaid = active.filter((r) => r.payment_status !== "paid").reduce((a, r) => a + Number(r.total) - Number(r.paid_amount ?? 0), 0);

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

          <InvoiceTable
            companyId={companyId}
            rows={list.map((r) => ({ ...r, subtotal: Number(r.subtotal), vat_amount: Number(r.vat_amount), total: Number(r.total), paid_amount: Number(r.paid_amount), original_exchange_rate: r.original_exchange_rate == null ? null : Number(r.original_exchange_rate) }))}
            direction={f.direction}
            currency={currency}
            canWrite={canWrite}
          />
          {list.length >= 1000 && <p className="text-xs text-muted-foreground">Shfaqen 1000 faturat e para — ngushto periudhën ose shkarko CSV-në.</p>}
        </>
      )}
    </div>
  );
}
