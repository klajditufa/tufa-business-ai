import { Title } from "@mantine/core";
import Link from "next/link";
import { IconChevronLeft as ChevronLeft, IconChevronRight as ChevronRight, IconDownload as Download } from "@tabler/icons-react";
import { getCompany } from "@/server/services/companies";
import { getAnnualReport, parseYear, type TopParty } from "@/server/services/reports";
import { Alert, Badge, Card, CardTitle } from "@/components/ui";
import { money } from "@/lib/format";
import { monthLabelSq } from "@/components/app/month-picker";
import { PrintButton } from "./print-button";

/**
 * Raporti vjetor nga faturat (CIS + manuale): xhiro, blerje, TVSH sipas muajve, pragjet ligjore
 * (nga tax_rules, me datë hyrjeje në fuqi), klientët dhe furnitorët kryesorë. Eksport CSV + printim/PDF.
 */
export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { companyId } = await params;
  const year = parseYear((await searchParams).year);
  const [company, { report, error }] = await Promise.all([getCompany(companyId), getAnnualReport(companyId, year)]);
  const cur = company?.base_currency ?? "ALL";
  const base = `/app/${companyId}/reports`;
  const now = new Date();
  const currentYear = now.getFullYear();
  // muajt e kaluar të vitit (për projeksionin); vit i mbyllur = 12
  const monthsElapsed = year < currentYear ? 12 : year > currentYear ? 0 : now.getMonth() + (now.getDate() >= 15 ? 1 : 0.5);
  const t = report?.totals;
  const sNet = Number(t?.s_net ?? 0);
  const pNet = Number(t?.p_net ?? 0);
  const projection = monthsElapsed > 0 && monthsElapsed < 12 ? (sNet / monthsElapsed) * 12 : sNet;

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Title order={2} fz={{ base: 20, sm: 24 }}>Raporti vjetor {year}</Title>
          <p className="text-sm text-muted-foreground">{company?.legal_name} · NIPT {company?.nipt}</p>
        </div>
        <div className="no-print flex items-center gap-2">
          <Link href={`${base}?year=${year - 1}`} className="rounded-lg border border-border p-1.5 hover:bg-muted" aria-label="Viti i mëparshëm"><ChevronLeft className="h-4 w-4" /></Link>
          <span className="min-w-12 text-center text-sm font-medium">{year}</span>
          {year < currentYear && <Link href={`${base}?year=${year + 1}`} className="rounded-lg border border-border p-1.5 hover:bg-muted" aria-label="Viti pasardhës"><ChevronRight className="h-4 w-4" /></Link>}
          <a href={`${base}/export?year=${year}`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-sm hover:bg-muted"><Download className="h-4 w-4" /> CSV</a>
          <PrintButton />
        </div>
      </div>

      {error && <Alert tone="danger">{error.message}</Alert>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi title="Xhiro (shitje pa TVSH)" value={money(sNet, cur, 0)} hint={`${t?.s_count ?? 0} fatura`} />
        <Kpi title="Blerje pa TVSH" value={money(pNet, cur, 0)} hint={`${t?.p_count ?? 0} fatura`} />
        <Kpi title="Diferenca shitje − blerje" value={money(sNet - pNet, cur, 0)} hint="orientuese, jo fitim kontabël" />
        {company?.vat_registered ? (
          <Kpi title="TVSH shitje − blerje" value={money(Number(t?.s_vat ?? 0) - Number(t?.p_vat ?? 0), cur, 0)} hint="para kredive të mbartura" />
        ) : (
          <Kpi title="Projeksioni i xhiros vjetore" value={money(projection, cur, 0)} hint={year === currentYear ? "mesatarja mujore × 12" : "viti i plotë"} />
        )}
      </div>

      {(report?.thresholds ?? []).length > 0 && (
        <Card className="print-break-avoid">
          <CardTitle>Pragjet ligjore të xhiros</CardTitle>
          <div className="mt-3 space-y-4">
            {report!.thresholds.map((th) => {
              const amount = Number(th.amount ?? 0);
              if (!amount) return null;
              const pct = Math.min(100, (sNet / amount) * 100);
              const projPct = Math.min(100, (projection / amount) * 100);
              const over = sNet >= amount;
              const projOver = !over && projection >= amount;
              const isVat = th.kind === "vat_exempt";
              return (
                <div key={th.kind + th.code}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">
                      {isVat ? "Pragu i regjistrimit në TVSH" : "Biznes i vogël (tatim fitimi 0%)"} · {money(amount, cur, 0)}
                    </span>
                    <span className="tabular">
                      {money(sNet, cur, 0)} ({pct.toFixed(0)}%)
                      {year === currentYear && <span className="text-muted-foreground"> · projeksion {money(projection, cur, 0)}</span>}
                    </span>
                  </div>
                  <div className="relative mt-1 h-2.5 overflow-hidden rounded-full bg-muted">
                    {year === currentYear && <div className="absolute inset-y-0 left-0 bg-warning/30" style={{ width: `${projPct}%` }} />}
                    <div className={`absolute inset-y-0 left-0 ${over ? "bg-danger" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {over && <Badge tone="danger">pragu u kalua</Badge>}
                    {projOver && <Badge tone="warning">sipas ritmit aktual kalohet brenda vitit</Badge>}
                    {isVat && company?.vat_registered && <Badge tone="neutral">subjekti është në TVSH</Badge>}
                    {!th.confirmed && <Badge tone="warning">vlerë e pakonfirmuar</Badge>}
                    <span>{th.source}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Xhiro llogaritet nga faturat e shitjes pa TVSH të regjistruara në platformë. Pragjet lexohen nga tabela e rregullave tatimore sipas vitit; kontrolloji para çdo vendimi.
          </p>
        </Card>
      )}

      <Card className="overflow-x-auto p-0 print-break-avoid">
        <div className="px-4 py-3"><CardTitle>Sipas muajve</CardTitle></div>
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Muaji</th>
              <th className="px-3 py-2 text-right">Shitje nr.</th>
              <th className="px-3 py-2 text-right">Shitje pa TVSH</th>
              <th className="px-3 py-2 text-right">TVSH shitje</th>
              <th className="px-3 py-2 text-right">Blerje nr.</th>
              <th className="px-3 py-2 text-right">Blerje pa TVSH</th>
              <th className="px-3 py-2 text-right">TVSH blerje</th>
              <th className="px-3 py-2 text-right">Diferenca</th>
            </tr>
          </thead>
          <tbody>
            {(report?.months ?? []).map((m) => {
              const d = new Date(m.m);
              const empty = !m.s_count && !m.p_count;
              return (
                <tr key={m.m} className={`border-t border-border ${empty ? "text-muted-foreground" : ""}`}>
                  <td className="px-3 py-2">
                    <Link href={`/app/${companyId}/invoices?direction=sale&period=${m.m.slice(0, 7)}`} className="no-print hover:underline">{monthLabelSq(d.getUTCFullYear(), d.getUTCMonth() + 1)}</Link>
                    <span className="hidden print:inline">{monthLabelSq(d.getUTCFullYear(), d.getUTCMonth() + 1)}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular">{m.s_count || ""}</td>
                  <td className="px-3 py-2 text-right tabular">{money(m.s_net, cur, 0)}</td>
                  <td className="px-3 py-2 text-right tabular">{money(m.s_vat, cur, 0)}</td>
                  <td className="px-3 py-2 text-right tabular">{m.p_count || ""}</td>
                  <td className="px-3 py-2 text-right tabular">{money(m.p_net, cur, 0)}</td>
                  <td className="px-3 py-2 text-right tabular">{money(m.p_vat, cur, 0)}</td>
                  <td className="px-3 py-2 text-right font-medium tabular">{money(Number(m.s_net) - Number(m.p_net), cur, 0)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-border bg-muted/50 font-medium">
            <tr>
              <td className="px-3 py-2">Totali {year}</td>
              <td className="px-3 py-2 text-right tabular">{t?.s_count ?? 0}</td>
              <td className="px-3 py-2 text-right tabular">{money(sNet, cur, 0)}</td>
              <td className="px-3 py-2 text-right tabular">{money(t?.s_vat ?? 0, cur, 0)}</td>
              <td className="px-3 py-2 text-right tabular">{t?.p_count ?? 0}</td>
              <td className="px-3 py-2 text-right tabular">{money(pNet, cur, 0)}</td>
              <td className="px-3 py-2 text-right tabular">{money(t?.p_vat ?? 0, cur, 0)}</td>
              <td className="px-3 py-2 text-right tabular">{money(sNet - pNet, cur, 0)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopTable title="Klientët kryesorë" rows={report?.top_customers ?? []} total={sNet} cur={cur} href={(id) => `/app/${companyId}/parties/${id}?type=customers`} />
        <TopTable title="Furnitorët kryesorë" rows={report?.top_suppliers ?? []} total={pNet} cur={cur} href={(id) => `/app/${companyId}/parties/${id}?type=suppliers`} />
      </div>

      <p className="text-xs text-muted-foreground">
        Burimi: faturat e sinkronizuara nga fiskalizimi (CIS) dhe ato të regjistruara në TUFA. Raport orientues; nuk zëvendëson pasqyrat financiare zyrtare.
      </p>
    </div>
  );
}

function Kpi({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Card className="print-break-avoid">
      <CardTitle>{title}</CardTitle>
      <div className="mt-2 text-xl font-semibold tabular">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function TopTable({ title, rows, total, cur, href }: { title: string; rows: TopParty[]; total: number; cur: string; href: (id: string) => string }) {
  return (
    <Card className="overflow-x-auto p-0 print-break-avoid">
      <div className="px-4 py-3"><CardTitle>{title}</CardTitle></div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={(r.party_id ?? "") + i} className="border-t border-border">
              <td className="w-6 px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
              <td className="px-3 py-2">
                {r.party_id ? <Link href={href(r.party_id)} className="hover:underline">{r.name}</Link> : r.name}
                {r.nipt && <div className="font-mono text-[11px] text-muted-foreground">{r.nipt}</div>}
              </td>
              <td className="px-3 py-2 text-right text-xs text-muted-foreground tabular">{r.invoices} fat.</td>
              <td className="px-3 py-2 text-right tabular">{money(r.net, cur, 0)}</td>
              <td className="w-14 px-3 py-2 text-right text-xs text-muted-foreground tabular">{total ? `${((Number(r.net) / total) * 100).toFixed(0)}%` : ""}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td className="px-3 py-3 text-muted-foreground">—</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}
