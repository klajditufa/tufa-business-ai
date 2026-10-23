import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, Empty } from "@/components/ui";
import { MonthPicker, monthLabelSq, parsePeriod } from "@/components/app/month-picker";
import { date, money } from "@/lib/format";

/** Ditët nga sinkronizimi i fundit → ton i badge-it. */
function syncInfo(at: string | null, now: number) {
  if (!at) return { tone: "neutral" as const, text: "pa sinkronizim" };
  const days = Math.floor((now - new Date(at).getTime()) / 86_400_000);
  return { tone: days <= 7 ? ("success" as const) : days <= 30 ? ("warning" as const) : ("danger" as const), text: days === 0 ? "sot" : `${days} ditë më parë` };
}

/**
 * Pasqyra e studios: për çdo subjekt në një muaj — sinkronizimi, shitjet, TVSH (pagesë/kredi),
 * arkëtimet e vonuara, xhiro vjetore kundrejt pragjeve dhe deklarimet që mbeten.
 */
export default async function StudioOverviewPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const { year, month } = parsePeriod(period);
  const supabase = await createClient();
  // Gjeneron deklarimet e muajit për çdo subjekt (si faqja Deklarimet), që numërimi të jetë i saktë
  await supabase.rpc("studio_declaration_matrix", { p_year: year, p_month: month });
  const { data, error } = await supabase.rpc("studio_overview", { p_year: year, p_month: month });
  const rows = data ?? [];
  const now = new Date().getTime();
  const pk = `${year}-${String(month).padStart(2, "0")}`;
  // projeksioni i xhiros vjetore nga muajt e kaluar të vitit deri në muajin e zgjedhur
  const proj = (ytd: number) => (ytd / month) * 12;

  const noSync = rows.filter((r) => !r.last_sync_at || now - new Date(r.last_sync_at).getTime() > 7 * 86_400_000);
  const vatTotal = rows.reduce((a, r) => a + Number(r.vat_payable ?? 0), 0);
  const late = rows.reduce((a, r) => a + (r.decl_late ?? 0), 0);
  const nearThreshold = rows.filter((r) => !r.vat_registered && r.vat_threshold && proj(Number(r.ytd_turnover)) >= 0.8 * Number(r.vat_threshold));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Pasqyra e subjekteve · {monthLabelSq(year, month)}</h1>
        <MonthPicker year={year} month={month} basePath="/studio/overview" />
      </div>
      {error && <p className="text-sm text-danger">{error.message}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-3"><div className="text-xs text-muted-foreground">TVSH për pagesë (gjithsej)</div><div className="text-lg font-semibold tabular">{money(vatTotal, "ALL", 0)}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Deklarime me vonesë</div><div className={`text-lg font-semibold tabular ${late ? "text-danger" : "text-success"}`}>{late}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Pa sinkronizim &gt; 7 ditë</div><div className={`text-lg font-semibold tabular ${noSync.length ? "text-warning" : "text-success"}`}>{noSync.length} / {rows.length}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Afër pragut të TVSH-së (≥ 80%)</div><div className={`text-lg font-semibold tabular ${nearThreshold.length ? "text-warning" : ""}`}>{nearThreshold.length}</div></Card>
      </div>

      {rows.length === 0 ? (
        <Empty title="Asnjë subjekt." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Subjekti</th>
                <th className="px-3 py-2">Fiskalizimi</th>
                <th className="px-3 py-2 text-right">Shitje e muajit</th>
                <th className="px-3 py-2 text-right">TVSH</th>
                <th className="px-3 py-2">Xhiro e vitit / pragu</th>
                <th className="px-3 py-2">Deklarimet</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = syncInfo(r.last_sync_at, now);
                const base = `/app/${r.company_id}`;
                const ytd = Number(r.ytd_turnover);
                const threshold = r.vat_registered ? Number(r.small_threshold ?? 0) : Number(r.vat_threshold ?? 0);
                const pct = threshold ? Math.min(100, (ytd / threshold) * 100) : 0;
                const projPct = threshold ? Math.min(100, (proj(ytd) / threshold) * 100) : 0;
                return (
                  <tr key={r.company_id} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <Link href={`${base}/dashboard`} className="font-medium hover:underline">{r.name}</Link>
                      <div className="font-mono text-[11px] text-muted-foreground">{r.nipt}{r.vat_registered ? " · TVSH" : ""}</div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={s.tone}>{s.text}</Badge>
                      {r.last_sync_at && <div className="mt-0.5 text-[11px] text-muted-foreground">{date(r.last_sync_at)}</div>}
                      {!r.last_sync_at && <Link href={`${base}/settings#sync`} className="mt-0.5 block text-[11px] text-accent hover:underline">lidh TUFA Sync</Link>}
                    </td>
                    <td className="px-3 py-2 text-right tabular">
                      <Link href={`${base}/invoices?direction=sale&period=${pk}`} className="hover:underline">{money(r.sales_net, "ALL", 0)}</Link>
                      <div className="text-[11px] text-muted-foreground">{r.sales_count} fatura · blerje {money(r.purchases_net, "ALL", 0)}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular">
                      {r.vat_registered ? (
                        <Link href={`${base}/vat?period=${pk}`} className="hover:underline">
                          {Number(r.vat_payable) > 0 ? (
                            <span className="font-medium text-warning">{money(r.vat_payable, "ALL", 0)}</span>
                          ) : (
                            <span className="text-success">kredi {money(r.vat_credit_cf, "ALL", 0)}</span>
                          )}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">jo në TVSH</span>
                      )}
                    </td>
                    <td className="min-w-48 px-3 py-2">
                      <div className="flex justify-between text-xs tabular">
                        <span>{money(ytd, "ALL", 0)}</span>
                        <span className="text-muted-foreground">{pct.toFixed(0)}% e {r.vat_registered ? "14 mln" : "pragut TVSH"}</span>
                      </div>
                      <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="absolute inset-y-0 left-0 bg-warning/30" style={{ width: `${projPct}%` }} />
                        <div className={`absolute inset-y-0 left-0 ${pct >= 100 ? "bg-danger" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                      </div>
                      {!r.vat_registered && projPct >= 100 && pct < 100 && <div className="mt-0.5 text-[11px] text-warning">sipas ritmit kalon pragun brenda vitit</div>}
                    </td>
                    <td className="px-3 py-2">
                      {(r.decl_open ?? 0) === 0 ? (
                        <Badge tone="success">të gjitha</Badge>
                      ) : (
                        <Link href={`/studio?period=${pk}`}>
                          <Badge tone={(r.decl_late ?? 0) > 0 ? "danger" : "warning"}>
                            {r.decl_open} pa deklaruar{(r.decl_late ?? 0) > 0 ? ` · ${r.decl_late} me vonesë` : ""}
                          </Badge>
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">
        TVSH-ja është llogaritje orientuese nga faturat (me kreditë e mbartura); vlera zyrtare është ajo e C@TS. Xhiro e vitit llogaritet deri në fund të muajit të zgjedhur; zona e hapur e shiritit është projeksioni deri në fund të vitit.
      </p>
    </div>
  );
}
