import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/server/services/companies";
import { Alert, Card, CardTitle, Empty } from "@/components/ui";
import { MonthPicker, monthLabelSq, parsePeriod } from "@/components/app/month-picker";
import { money } from "@/lib/format";
import { t } from "@/lib/i18n";

/**
 * TVSH bazë: përmbledhja e shitjeve dhe blerjeve sipas normave për periudhën, nga funksioni SQL vat_summary.
 * Çdo shifër është llogaritje orientuese nga faturat e importuara; deklarimi bëhet nga kontabilisti në C@TS.
 */
export default async function VatPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { companyId } = await params;
  const { period } = await searchParams;
  const { year, month } = parsePeriod(period);
  const d = t();
  const supabase = await createClient();
  const company = await getCompany(companyId);
  const currency = company?.base_currency ?? "ALL";

  // Periudha (krijohet nëse mungon) → vat_summary + normat në fuqi
  const { data: periodRow } = await supabase
    .from("fiscal_periods")
    .select("id, status")
    .eq("company_id", companyId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  const periodEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const [{ data: rows, error }, { data: rates }] = await Promise.all([
    periodRow ? supabase.rpc("vat_summary", { p_company_id: companyId, p_period_id: periodRow.id }) : Promise.resolve({ data: [], error: null }),
    supabase.rpc("vat_rates_at", { p_date: periodEnd, p_company_id: companyId }),
  ]);

  const sales = (rows ?? []).filter((r) => r.direction === "sale");
  const purchases = (rows ?? []).filter((r) => r.direction === "purchase");
  const sum = (xs: typeof sales, k: "base_amount" | "vat_amount") => xs.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const outVat = sum(sales, "vat_amount");
  const inVat = sum(purchases, "vat_amount");
  const balance = outVat - inVat;
  const basePath = `/app/${companyId}/vat`;

  if (company && !company.vat_registered) {
    return (
      <div className="space-y-4 pb-20 lg:pb-0">
        <h1 className="text-2xl font-semibold">{d.nav.vat}</h1>
        <Alert tone="info">Ky subjekt nuk është i regjistruar në TVSH. Nëse kjo ka ndryshuar, përditësoje te Parametrat.</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{d.nav.vat} · {monthLabelSq(year, month)}</h1>
        <MonthPicker year={year} month={month} basePath={basePath} />
      </div>
      {error && <Alert tone="danger">{error.message}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi title="TVSH e shitjeve (e mbledhur)" value={money(outVat, currency)} />
        <Kpi title="TVSH e blerjeve (e zbritshme)" value={money(inVat, currency)} />
        <Kpi
          title={balance >= 0 ? "TVSH për pagesë" : "TVSH për kreditim"}
          value={money(Math.abs(balance), currency)}
          tone={balance > 0 ? "warning" : "success"}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Llogaritje orientuese nga faturat e regjistruara në TUFA Business AI për periudhën {monthLabelSq(year, month)}
        {periodRow?.status === "closed" ? " · periudhë e mbyllur" : ""}. Vlera zyrtare është ajo e deklaruar në C@TS.
      </p>

      {(rows ?? []).length === 0 ? (
        <Empty title="Asnjë faturë për këtë periudhë." hint="Importo faturat e shitjes dhe blerjes që TVSH-ja të llogaritet automatikisht." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <VatTable title="Shitjet sipas normave" rows={sales} currency={currency} />
          <VatTable title="Blerjet sipas normave" rows={purchases} currency={currency} />
        </div>
      )}

      <Card>
        <CardTitle>Normat e TVSH-së në fuqi ({periodEnd.split("-").reverse().join(".")})</CardTitle>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {(rates ?? []).map((r) => (
            <li key={r.code} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span>{r.label ?? r.code}</span>
              <span className="font-semibold tabular">{Number(r.rate)}%</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Normat vijnë nga tabela e rregullave tatimore me datë hyrjeje në fuqi; nuk janë të ngulitura në kod.
          Deklarimi: <Link href={`/app/${companyId}/declarations?period=${year}-${String(month).padStart(2, "0")}`} className="text-accent hover:underline">statusi i TVSH-së për këtë muaj →</Link>
        </p>
      </Card>
    </div>
  );
}

function Kpi({ title, value, tone }: { title: string; value: string; tone?: "warning" | "success" }) {
  const color = tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "";
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div className={`mt-2 text-2xl font-semibold tabular ${color}`}>{value}</div>
    </Card>
  );
}

function VatTable({ title, rows, currency }: { title: string; rows: { vat_rate: number; base_amount: number; vat_amount: number; invoice_count: number }[]; currency: string }) {
  const tb = rows.reduce((a, r) => a + Number(r.base_amount), 0);
  const tv = rows.reduce((a, r) => a + Number(r.vat_amount), 0);
  return (
    <Card className="overflow-x-auto p-0">
      <div className="px-4 py-3 text-sm font-medium">{title}</div>
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
          <tr><th className="px-4 py-2">Norma</th><th className="px-4 py-2 text-right">Baza</th><th className="px-4 py-2 text-right">TVSH</th><th className="px-4 py-2 text-right">Fatura</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              <td className="px-4 py-2 tabular">{Number(r.vat_rate)}%</td>
              <td className="px-4 py-2 text-right tabular">{money(r.base_amount, currency)}</td>
              <td className="px-4 py-2 text-right tabular">{money(r.vat_amount, currency)}</td>
              <td className="px-4 py-2 text-right tabular">{r.invoice_count}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-3 text-muted-foreground">—</td></tr>}
        </tbody>
        <tfoot className="border-t border-border bg-muted/50 font-medium">
          <tr><td className="px-4 py-2">Totali</td><td className="px-4 py-2 text-right tabular">{money(tb, currency)}</td><td className="px-4 py-2 text-right tabular">{money(tv, currency)}</td><td /></tr>
        </tfoot>
      </table>
    </Card>
  );
}
