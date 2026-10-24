import { IconArrowDownLeft as ArrowDownLeft, IconArrowUpRight as ArrowUpRight } from "@tabler/icons-react";
import { getCompany } from "@/server/services/companies";
import { filterRange, getSyncStatus, listInvoices, parseInvoiceFilters } from "@/server/services/invoices";
import { Empty, PageTitle, Stat } from "@/components/ui";
import { date, money } from "@/lib/format";
import { InvoiceFilterBar } from "../filters";
import { InvoiceTable } from "../invoice-table";
import { createClient } from "@/lib/supabase/server";

/**
 * Shitjet / Blerjet (pamja e cis-client-2): periudha, filtrat, katër kartat e totaleve dhe tabela.
 * Faturat merren nga fiskalizimi (CIS) me “Merr nga CIS” (certifikata në shfletues) ose me TUFA Sync; pagesat shënohen këtu.
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
  const range = filterRange(f);
  const basePath = `/app/${companyId}/invoices/payments`;
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
  const sale = f.direction === "sale";
  // Subjekt pa TVSH: shitjet nuk kanë TVSH, prandaj karta fshihet (blerjet e mbajnë).
  const showVat = !sale || company?.vat_registered !== false;
  const itemsPeriod = (range?.from ?? new Date().toISOString()).slice(0, 7);
  const itemsHref = `/app/${companyId}/tools/items?direction=${f.direction}&period=${itemsPeriod}`;
  const dmy = (d: string) => d.split("-").reverse().join("/");

  return (
    <div className="space-y-5">
      <PageTitle
        icon={sale ? ArrowUpRight : ArrowDownLeft}
        tone={sale ? "teal" : "indigo"}
        title={sale ? "Pagesat e shitjeve" : "Pagesat e blerjeve"}
        subtitle={sale ? "Arkëtimet: shëno faturat e paguara, rakordo me bankën." : "Pagesat ndaj furnitorëve: shëno faturat e paguara, rakordo me bankën."}
      />

      <InvoiceFilterBar basePath={basePath} itemsHref={itemsHref} f={f} range={range} />

      {error && <p className="text-sm text-danger">{error.message}</p>}

      {list.length === 0 ? (
        <Empty
          title={sync?.last_sync_at ? "Asnjë faturë për këtë përzgjedhje." : "Ende pa fatura nga fiskalizimi."}
          hint={
            sync?.last_sync_at
              ? `Sinkronizimi i fundit: ${date(sync.last_sync_at)}. Provo një periudhë tjetër ose hiq filtrat.`
              : "Zgjidh periudhën dhe shtyp “Merr nga CIS”: herën e parë kërkohet certifikata .p12 e subjektit dhe fjalëkalimi i saj."
          }
        />
      ) : (
        <>
          <div className={`grid grid-cols-2 gap-3 ${showVat ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            <Stat label="Fatura" value={active.length} />
            <Stat label="Pa TVSH" value={money(sum("subtotal"), currency).replace(/ LEK$/, "")} />
            {showVat && <Stat label="TVSH" value={money(sum("vat_amount"), currency).replace(/ LEK$/, "")} />}
            <Stat
              label={`Totali (${currency})`}
              value={money(sum("total"), currency).replace(/ LEK$/, "")}
              hint={unpaid > 0 ? `${money(unpaid, currency, 0)} të papaguara` : "të gjitha të paguara"}
              highlight
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span className="tabular">{range ? `${dmy(range.from)} – ${dmy(range.to)}` : "Të gjitha periudhat"}</span>
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
