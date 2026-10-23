import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, Empty } from "@/components/ui";
import { MonthPicker, monthLabelSq, parsePeriod } from "@/components/app/month-picker";
import { formatCents } from "@/lib/payroll-calc";
import { itemsOf, summariseItems } from "@/lib/invoice-items";
import { cn } from "@/lib/utils";

export const metadata = { title: "Faturat sipas artikujve" };

/** Shitjet / blerjet sipas artikujve, nga artikujt e faturave CIS (sinkronizim me detaje). */
export default async function ItemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ period?: string; direction?: string; scope?: string }>;
}) {
  const { companyId } = await params;
  const sp = await searchParams;
  const { year, month } = parsePeriod(sp.period);
  const direction = sp.direction === "purchase" ? "purchase" : "sale";
  const wholeYear = sp.scope === "year";
  const from = wholeYear ? `${year}-01-01` : `${year}-${String(month).padStart(2, "0")}-01`;
  const to = wholeYear ? `${year}-12-31` : new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, raw, original_currency")
    .eq("company_id", companyId)
    .eq("direction", direction)
    .is("deleted_at", null)
    .gte("issue_date", from)
    .lte("issue_date", to)
    .limit(20000);
  const invoices = (data ?? []).map((r) => ({ id: r.id, items: itemsOf(r.raw), foreign: !!r.original_currency && r.original_currency !== "ALL" }));
  const withItems = invoices.filter((i) => i.items !== null) as { id: string; items: NonNullable<ReturnType<typeof itemsOf>>; foreign: boolean }[];
  const missing = invoices.length - withItems.length;
  const rows = summariseItems(withItems);
  const foreign = withItems.filter((i) => i.foreign).length;
  const base = `/app/${companyId}/tools/items`;
  const q = (o: Record<string, string>) =>
    `${base}?${new URLSearchParams({ period: `${year}-${String(month).padStart(2, "0")}`, direction, ...(wholeYear ? { scope: "year" } : {}), ...o })}`;
  const totals = rows.reduce((a, r) => ({ net: a.net + r.net, vat: a.vat + r.vat, total: a.total + r.total }), { net: 0, vat: 0, total: 0 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Faturat sipas artikujve</h2>
          <p className="text-sm text-muted-foreground">Sasitë dhe vlerat për çdo artikull, nga rreshtat e faturave të fiskalizimit.</p>
        </div>
        {!wholeYear && <MonthPicker year={year} month={month} basePath={`${base}?direction=${direction}`} />}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <div className="inline-flex rounded-lg bg-muted p-1">
          {(["sale", "purchase"] as const).map((d) => (
            <Link key={d} href={q({ direction: d })} className={cn("rounded-md px-3 py-1.5", direction === d ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
              {d === "sale" ? "Shitjet" : "Blerjet"}
            </Link>
          ))}
        </div>
        <div className="inline-flex rounded-lg bg-muted p-1">
          <Link href={`${base}?${new URLSearchParams({ period: `${year}-${String(month).padStart(2, "0")}`, direction })}`} className={cn("rounded-md px-3 py-1.5", !wholeYear ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
            Muaji
          </Link>
          <Link href={q({ scope: "year" })} className={cn("rounded-md px-3 py-1.5", wholeYear ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
            Viti {year}
          </Link>
        </div>
      </div>

      {error && <Alert tone="danger">{error.message}</Alert>}
      {missing > 0 && rows.length > 0 && (
        <Alert tone="info">
          {missing} nga {invoices.length} fatura nuk kanë ende artikuj; totalet më poshtë mbulojnë vetëm {withItems.length} faturat e tjera.
          Nis sinkronizimin edhe një herë që t’i plotësosh.
        </Alert>
      )}

      {rows.length === 0 ? (
        invoices.length > 0 ? (
          <Card className="space-y-3">
            <div className="font-semibold">Artikujt e këtyre {invoices.length} faturave nuk janë marrë ende nga fiskalizimi</div>
            <p className="text-sm text-muted-foreground">
              Lista e faturave nga CIS nuk i përmban artikujt: ata merren duke hapur çdo faturë me certifikatën e subjektit, e cila mbetet në
              kompjuterin e tij. Faturat e kësaj periudhe janë sinkronizuar pa ta.
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Në kompjuterin me certifikatën, hap Terminal brenda dosjes <code>tufa-sync</code>.</li>
              <li>
                Nis sinkronizimin për periudhën:
                <pre className="mt-1 overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">{`./start.sh push --details --from ${from} --to ${to}`}</pre>
              </li>
              <li>Rifresko këtë faqe: artikujt dalin menjëherë. Faturat ekzistuese përditësohen, nuk dyfishohen.</li>
            </ol>
          </Card>
        ) : (
          <Empty title={`Asnjë faturë për ${wholeYear ? `vitin ${year}` : monthLabelSq(year, month)}.`} hint="Provo një periudhë tjetër ose sinkronizo faturat me TUFA Sync." />
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="p-3"><div className="text-xs text-muted-foreground">Artikuj</div><div className="text-lg font-semibold tabular">{rows.length}</div></Card>
            <Card className="p-3"><div className="text-xs text-muted-foreground">Pa TVSH</div><div className="text-lg font-semibold tabular">{formatCents(totals.net)}</div></Card>
            <Card className="p-3"><div className="text-xs text-muted-foreground">TVSH</div><div className="text-lg font-semibold tabular">{formatCents(totals.vat)}</div></Card>
            <Card className="border-accent/60 p-3"><div className="text-xs text-muted-foreground">Totali</div><div className="text-lg font-semibold tabular">{formatCents(totals.total)}</div></Card>
          </div>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Artikulli</th>
                  <th className="px-3 py-2">Njësia</th>
                  <th className="px-3 py-2 text-right">Sasia</th>
                  <th className="px-3 py-2 text-right">Pa TVSH</th>
                  <th className="px-3 py-2 text-right">TVSH</th>
                  <th className="px-3 py-2 text-right">Totali</th>
                  <th className="px-3 py-2 text-right">Fatura</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.name}</div>
                      {r.codes.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {r.codes.slice(0, 3).join(" / ")}
                          {r.codes.length > 3 ? ` +${r.codes.length - 3}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">{r.unit}</td>
                    <td className="px-3 py-2 text-right tabular">{String(r.quantity)}</td>
                    <td className="px-3 py-2 text-right tabular">{formatCents(r.net)}</td>
                    <td className="px-3 py-2 text-right tabular">{formatCents(r.vat)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular">{formatCents(r.total)}</td>
                    <td className="px-3 py-2 text-right tabular">{r.invoices}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {foreign > 0 && (
            <p className="text-xs text-muted-foreground">{foreign} fatura janë në monedhë të huaj; artikujt e tyre janë në monedhën e faturës, siç i dërgon CIS.</p>
          )}
        </>
      )}
    </div>
  );
}
