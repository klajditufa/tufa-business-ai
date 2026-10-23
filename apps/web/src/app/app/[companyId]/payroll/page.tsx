import { IconWallet as Wallet } from "@tabler/icons-react";
import { PageTitle } from "@/components/ui";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listPayrollDeclarations } from "@/server/services/payroll";
import { Badge, Card, Empty } from "@/components/ui";
import { monthLabelSq } from "@/components/app/month-picker";
import { date, money } from "@/lib/format";
import { CatsImport } from "./cats-import";
import { getCompany } from "@/server/services/companies";

const statusTone = (s: string | null) =>
  !s ? "neutral" : /refuz|gabime/i.test(s) ? "danger" : /paguar/i.test(s) && !/papaguar/i.test(s) ? "success" : /regjistruar|aprovuar|dërgua pa gabime/i.test(s) ? "info" : "warning";

/**
 * Listëpagesat siç janë deklaruar në C@TS (importi i eksportit Excel të e-Filing).
 * Nuk ka llogaritje lokale: vlerat janë ato zyrtare.
 */
export default async function PayrollPage({ params, searchParams }: { params: Promise<{ companyId: string }>; searchParams: Promise<{ capture?: string }> }) {
  const { companyId } = await params;
  const { capture } = await searchParams;
  const company = await getCompany(companyId);
  const supabase = await createClient();
  const [{ rows, error }, { data: perms }] = await Promise.all([listPayrollDeclarations(companyId), supabase.rpc("my_permissions", { p_company_id: companyId })]);
  const canWrite = (perms ?? []).some((p) => p.module === "payroll" && p.action === "write");
  const year = new Date().getFullYear();
  const ytd = rows.filter((r) => r.year === year);
  const sum = (k: "social" | "health" | "income_tax") => ytd.reduce((a, r) => a + Number(r[k]), 0);

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <PageTitle
        icon={Wallet}
        tone="violet"
        title="Listëpagesa (E-SIG 025)"
        subtitle="Vlerat zyrtare nga C@TS. Importi shënon edhe deklarimin e muajit si “deklaruar” dhe shton detyrimet me afatin nga e-Filing."
      >
        <a
          href="/tufa-efiling.zip"
          download
          title="Shtesa e Chrome që dërgon këtu faqet e listëpagesës nga e-Filing"
          className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:bg-muted"
        >
          Shtesa e-Filing
        </a>
        <Link href={`/app/${companyId}/tools/net-gross`} className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:bg-muted">
          Neto / bruto
        </Link>
      </PageTitle>

      <CatsImport companyId={companyId} canWrite={canWrite} companyNipt={company?.nipt} captureId={capture && /^[0-9a-f-]{36}$/.test(capture) ? capture : undefined} />
      {error && <p className="text-sm text-danger">{error.message}</p>}

      {rows.length === 0 ? (
        <Empty title="Ende pa listëpagesa." hint="Ngarko eksportin “Listëpagesa të Dorëzuara” nga e-Filing (zgjidh “Shfaq 1000” para eksportit që të vijnë të gjithë muajt)." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="p-3"><div className="text-xs text-muted-foreground">Muaj të deklaruar {year}</div><div className="text-lg font-semibold tabular">{ytd.length}</div></Card>
            <Card className="p-3"><div className="text-xs text-muted-foreground">Sig. shoqërore {year}</div><div className="text-lg font-semibold tabular">{money(sum("social"), "ALL", 0)}</div></Card>
            <Card className="p-3"><div className="text-xs text-muted-foreground">Sig. shëndetësore {year}</div><div className="text-lg font-semibold tabular">{money(sum("health"), "ALL", 0)}</div></Card>
            <Card className="p-3"><div className="text-xs text-muted-foreground">TAP {year}</div><div className="text-lg font-semibold tabular">{money(sum("income_tax"), "ALL", 0)}</div></Card>
          </div>

          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Periudha</th>
                  <th className="px-3 py-2">Dorëzuar</th>
                  <th className="px-3 py-2">Afati</th>
                  <th className="px-3 py-2 text-right">Punëm.</th>
                  <th className="px-3 py-2 text-right">Pagat</th>
                  <th className="px-3 py-2 text-right">Sig. shoq.</th>
                  <th className="px-3 py-2 text-right">Sig. shënd.</th>
                  <th className="px-3 py-2 text-right">TAP</th>
                  <th className="px-3 py-2 text-right">Për pagesë</th>
                  <th className="px-3 py-2">Statusi C@TS</th>
                  <th className="px-3 py-2">ISSH</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pk = `${r.year}-${String(r.month).padStart(2, "0")}`;
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2">
                        <Link href={`/app/${companyId}/payroll/${pk}`} className="font-medium hover:underline">{monthLabelSq(r.year, r.month)}</Link>
                        {r.model !== "Normal" && <div className="text-[11px] text-warning">{r.model}</div>}
                        {r.hasLines && <div className="text-[11px] text-muted-foreground">me detaje</div>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular">{r.submitted_on ? date(r.submitted_on) : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular">{r.due_date ? date(r.due_date) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular">{r.employees}</td>
                      <td className="px-3 py-2 text-right tabular">{money(r.gross, "ALL", 0)}</td>
                      <td className="px-3 py-2 text-right tabular">{money(r.social, "ALL", 0)}</td>
                      <td className="px-3 py-2 text-right tabular">{money(r.health, "ALL", 0)}</td>
                      <td className="px-3 py-2 text-right tabular">{money(r.income_tax, "ALL", 0)}</td>
                      <td className="px-3 py-2 text-right font-medium tabular">{money(Number(r.social) + Number(r.health) + Number(r.income_tax), "ALL", 0)}</td>
                      <td className="px-3 py-2"><Badge tone={statusTone(r.cats_status)}>{r.cats_status?.replace(/\.$/, "") ?? "—"}</Badge></td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">{r.issh_status ?? "—"}{r.issh_sent_on ? ` · ${date(r.issh_sent_on)}` : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
