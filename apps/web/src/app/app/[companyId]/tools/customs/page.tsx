import { createClient } from "@/lib/supabase/server";
import { Card, Empty } from "@/components/ui";
import { MonthPicker, monthLabelSq, parsePeriod } from "@/components/app/month-picker";
import { formatCents } from "@/lib/payroll-calc";
import { CustomsForm, CustomsTable, type CustomsRow } from "./customs-client";

export const metadata = { title: "Deklaratat doganore" };

/** Deklaratat doganore dhe përputhja me faturat e blerjes nga CIS (sipas NIVF ose numrit). */
export default async function CustomsPage({ params, searchParams }: { params: Promise<{ companyId: string }>; searchParams: Promise<{ period?: string }> }) {
  const { companyId } = await params;
  const { year, month } = parsePeriod((await searchParams).period);
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const supabase = await createClient();
  const [{ data, error }, { data: perms }] = await Promise.all([
    supabase.rpc("customs_matches", { p_company_id: companyId, p_from: from, p_to: to }),
    supabase.rpc("my_permissions", { p_company_id: companyId }),
  ]);
  const canWrite = (perms ?? []).some((p) => p.module === "vat" && p.action === "write");
  const rows = (data ?? []) as CustomsRow[];
  const sum = (k: "import_vat" | "duty") => formatCents(rows.reduce((a, r) => a + Math.round(Number(r[k]) * 100), 0));
  const unmatched = rows.filter((r) => !r.invoice_id).length;
  const differing = rows.filter((r) => r.vat_difference != null && Math.abs(Number(r.vat_difference)) >= 0.01).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Deklaratat doganore</h2>
          <p className="text-sm text-muted-foreground">Deklaratat e importit krahasuar me faturat e blerjes nga fiskalizimi.</p>
        </div>
        <MonthPicker year={year} month={month} basePath={`/app/${companyId}/tools/customs`} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Deklarata · {monthLabelSq(year, month)}</div><div className="text-lg font-semibold tabular">{rows.length}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">TVSH në import</div><div className="text-lg font-semibold tabular">{sum("import_vat")}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Detyrime doganore</div><div className="text-lg font-semibold tabular">{sum("duty")}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Pa faturë / me diferencë</div><div className={`text-lg font-semibold tabular ${unmatched + differing ? "text-warning" : ""}`}>{unmatched} / {differing}</div></Card>
      </div>
      {canWrite && <CustomsForm companyId={companyId} defaultDate={from} />}
      {error && <p className="text-sm text-danger">{error.message}</p>}
      {rows.length === 0 ? (
        <Empty title={`Asnjë deklaratë doganore për ${monthLabelSq(year, month)}.`} hint="Shto deklaratat e importit; sistemi gjen faturën përkatëse të blerjes." />
      ) : (
        <CustomsTable companyId={companyId} rows={rows} canWrite={canWrite} />
      )}
      <p className="text-xs text-muted-foreground">
        Përputhja është tregues ndihmës, jo vërtetim i pajtueshmërisë doganore. Kërkohet së pari NIVF-ja e shënuar, përndryshe numri i faturës = numri i deklaratës.
      </p>
    </div>
  );
}
