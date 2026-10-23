import { IconPercentage as Percent } from "@tabler/icons-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/server/services/companies";
import { Alert, Card, CardTitle, Empty, PageTitle } from "@/components/ui";
import { MonthPicker, monthLabelSq, parsePeriod } from "@/components/app/month-picker";
import { money } from "@/lib/format";
import { t } from "@/lib/i18n";
import { VatOfficialForm } from "./official-form";

type Position = {
  output_vat: number; input_vat: number; sales_base: number; purchases_base: number;
  sales_count: number; purchases_count: number; credit_bf: number; credit_bf_source: "official" | "computed" | "none";
  payable: number; credit_cf: number; computed_since: string;
  official: { output_vat?: number; input_vat?: number; payable?: number; credit_cf?: number; note?: string; recorded_at?: string };
};

/**
 * TVSH: pozicioni mujor (vat_position: TVSH shitje − blerje − kredi e mbartur), ndarja sipas normave (vat_summary)
 * dhe krahasimi me vlerat zyrtare të C@TS. Shifrat e sistemit janë orientuese; deklarimi bëhet nga kontabilisti në C@TS.
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
  const [{ data: rows, error }, { data: rates }, { data: posData }, { data: perms }] = await Promise.all([
    periodRow ? supabase.rpc("vat_summary", { p_company_id: companyId, p_period_id: periodRow.id }) : Promise.resolve({ data: [], error: null }),
    supabase.rpc("vat_rates_at", { p_date: periodEnd, p_company_id: companyId }),
    supabase.rpc("vat_position", { p_company_id: companyId, p_year: year, p_month: month }),
    supabase.rpc("my_permissions", { p_company_id: companyId }),
  ]);
  const pos = (posData ?? null) as unknown as Position | null;
  const canWrite = (perms ?? []).some((p) => p.module === "declarations" && p.action === "write");

  const sales = (rows ?? []).filter((r) => r.direction === "sale");
  const purchases = (rows ?? []).filter((r) => r.direction === "purchase");
  const outVat = Number(pos?.output_vat ?? 0);
  const inVat = Number(pos?.input_vat ?? 0);
  const bf = Number(pos?.credit_bf ?? 0);
  const payable = Number(pos?.payable ?? 0);
  const creditCf = Number(pos?.credit_cf ?? 0);
  const off = pos?.official ?? {};
  const basePath = `/app/${companyId}/vat`;
  const bfLabel = pos?.credit_bf_source === "official" ? "nga C@TS (muaji i kaluar)" : pos?.credit_bf_source === "computed" ? `llogaritur nga sistemi që nga ${pos.computed_since}` : "pa kredi të mëparshme";

  if (company && !company.vat_registered) {
    return (
      <div className="space-y-4 pb-20 lg:pb-0">
        <PageTitle icon={Percent} tone="indigo" title={d.nav.vat} />
        <Alert tone="info">Ky subjekt nuk është i regjistruar në TVSH. Nëse kjo ka ndryshuar, përditësoje te Parametrat.</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <PageTitle icon={Percent} tone="indigo" title={`${d.nav.vat} · ${monthLabelSq(year, month)}`} subtitle="Përgatitja e TVSH-së nga faturat e fiskalizimit dhe krahasimi me deklaratën në C@TS.">
        <MonthPicker year={year} month={month} basePath={basePath} />
      </PageTitle>
      {error && <Alert tone="danger">{error.message}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="TVSH e shitjeve (e mbledhur)" value={money(outVat, currency)} hint={`${pos?.sales_count ?? 0} fatura · bazë ${money(pos?.sales_base ?? 0, currency, 0)}`} />
        <Kpi title="TVSH e blerjeve (e zbritshme)" value={money(inVat, currency)} hint={`${pos?.purchases_count ?? 0} fatura · bazë ${money(pos?.purchases_base ?? 0, currency, 0)}`} />
        <Kpi title="Kredi e mbartur (hyrëse)" value={money(bf, currency)} hint={bfLabel} />
        {payable > 0 ? (
          <Kpi title="TVSH për pagesë" value={money(payable, currency)} tone="warning" hint="afati: shih Deklarimet / kalendarin fiskal" />
        ) : (
          <Kpi title="Kredi për t'u mbartur" value={money(creditCf, currency)} tone="success" hint="kalon si kredi hyrëse në muajin tjetër" />
        )}
      </div>
      <p className="text-xs text-muted-foreground tabular">
        {money(outVat, currency)} − {money(inVat, currency)} − {money(bf, currency)} = {money(outVat - inVat - bf, currency)}
      </p>
      <p className="text-xs text-muted-foreground">
        Llogaritje orientuese nga faturat e regjistruara në TUFA Business AI për periudhën {monthLabelSq(year, month)}
        {periodRow?.status === "closed" ? " · periudhë e mbyllur" : ""}. Vlera zyrtare është ajo e deklaruar në C@TS.
      </p>

      {(rows ?? []).length === 0 ? (
        <Empty title="Asnjë faturë për këtë periudhë." hint="Merri faturat te Shitjet / Blerjet me “Merr nga CIS” (certifikata e subjektit)." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <VatTable title="Shitjet sipas normave" rows={sales} currency={currency} />
          <VatTable title="Blerjet sipas normave" rows={purchases} currency={currency} />
        </div>
      )}

      <Card>
        <CardTitle>Krahasimi me deklaratën në C@TS</CardTitle>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
              <tr><th className="py-2 pr-4">Zëri</th><th className="py-2 pr-4 text-right">TUFA (llogaritur)</th><th className="py-2 pr-4 text-right">C@TS (zyrtare)</th><th className="py-2 text-right">Diferenca</th></tr>
            </thead>
            <tbody>
              {(
                [
                  ["TVSH e shitjeve", outVat, off.output_vat],
                  ["TVSH e blerjeve", inVat, off.input_vat],
                  ["TVSH për pagesë", payable, off.payable],
                  ["Kredi për t'u mbartur", creditCf, off.credit_cf],
                ] as const
              ).map(([label, mine, theirs]) => {
                const diff = theirs == null ? null : Number(theirs) - mine;
                return (
                  <tr key={label} className="border-t border-border">
                    <td className="py-2 pr-4">{label}</td>
                    <td className="py-2 pr-4 text-right tabular">{money(mine, currency)}</td>
                    <td className="py-2 pr-4 text-right tabular">{theirs == null ? "—" : money(theirs, currency)}</td>
                    <td className={`py-2 text-right tabular ${diff == null ? "" : Math.abs(diff) < 1 ? "text-success" : "text-warning"}`}>
                      {diff == null ? "" : Math.abs(diff) < 1 ? "✓" : money(diff, currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {off.note && <p className="mt-2 text-xs text-muted-foreground">Shënim: {off.note}</p>}
        <div className="mt-4">
          {canWrite ? (
            <VatOfficialForm companyId={companyId} year={year} month={month} official={off} />
          ) : (
            <p className="text-xs text-muted-foreground">Vlerat zyrtare i regjistron kontabilisti pas deklarimit në C@TS.</p>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Diferencat zakonisht vijnë nga fatura që mungojnë në sinkronizim, fatura të periudhave të tjera, ose TVSH e pazbritshme. Kontrollo regjistrin e{" "}
          <Link href={`/app/${companyId}/invoices?direction=purchase&period=${year}-${String(month).padStart(2, "0")}`} className="text-accent hover:underline">blerjeve</Link> dhe{" "}
          <Link href={`/app/${companyId}/invoices?direction=sale&period=${year}-${String(month).padStart(2, "0")}`} className="text-accent hover:underline">shitjeve</Link>.
        </p>
      </Card>

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

function Kpi({ title, value, tone, hint }: { title: string; value: string; tone?: "warning" | "success"; hint?: string }) {
  const color = tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "";
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div className={`mt-2 text-2xl font-semibold tabular ${color}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
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
        <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
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
