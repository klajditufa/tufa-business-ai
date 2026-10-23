import { createClient } from "@/lib/supabase/server";
import { Card, Empty } from "@/components/ui";
import { MonthPicker, monthLabelSq, parsePeriod } from "@/components/app/month-picker";
import { formatCents } from "@/lib/payroll-calc";
import { RentForm, RentTable, type RentRow } from "./rent-client";

export const metadata = { title: "Tatimi në burim · Qira" };

/** Tatimi në burim për qiranë: 15% mbi max(qiraja kontraktuale, minimumi referues). */
export default async function RentPage({ params, searchParams }: { params: Promise<{ companyId: string }>; searchParams: Promise<{ period?: string }> }) {
  const { companyId } = await params;
  const { year, month } = parsePeriod((await searchParams).period);
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const supabase = await createClient();
  const [{ data, error }, { data: perms }, { data: yearRows }] = await Promise.all([
    supabase.from("rent_withholdings").select("*").eq("company_id", companyId).gte("doc_date", from).lte("doc_date", to).order("doc_date"),
    supabase.rpc("my_permissions", { p_company_id: companyId }),
    supabase.from("rent_withholdings").select("tax").eq("company_id", companyId).gte("doc_date", `${year}-01-01`).lte("doc_date", `${year}-12-31`),
  ]);
  const canWrite = (perms ?? []).some((p) => p.module === "declarations" && p.action === "write");
  const rows = (data ?? []) as RentRow[];
  const cents = (list: { tax: number | null }[]) => list.reduce((a, r) => a + Math.round(Number(r.tax) * 100), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Tatimi në burim · Qira</h2>
          <p className="text-sm text-muted-foreground">Qiratë e paguara dhe tatimi i mbajtur në burim, për deklaratën mujore në C@TS.</p>
        </div>
        <MonthPicker year={year} month={month} basePath={`/app/${companyId}/tools/rent`} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Qira në {monthLabelSq(year, month)}</div><div className="text-lg font-semibold tabular">{rows.length}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">TAP i muajit</div><div className="text-lg font-semibold tabular">{formatCents(cents(rows))}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">TAP {year}</div><div className="text-lg font-semibold tabular">{formatCents(cents(yearRows ?? []))}</div></Card>
      </div>

      {canWrite && <RentForm companyId={companyId} defaultDate={from} />}
      {error && <p className="text-sm text-danger">{error.message}</p>}
      {rows.length === 0 ? (
        <Empty title={`Asnjë qira për ${monthLabelSq(year, month)}.`} hint="Shto qiratë e paguara këtë muaj; tatimi llogaritet automatikisht." />
      ) : (
        <RentTable companyId={companyId} rows={rows} canWrite={canWrite} />
      )}
      <p className="text-xs text-muted-foreground">
        Vlerësim. Minimumin referues dhe trajtimin sipas marrëveshjeve për tatimin e dyfishtë i vendos kontabilisti. Burime:{" "}
        <a className="underline" href="https://www.tatime.gov.al/d/8/45/45/1859/pyetje-pergjigje-per-tatimin-ne-burim" target="_blank" rel="noreferrer">DPT · tatimi në burim</a>.
      </p>
    </div>
  );
}
