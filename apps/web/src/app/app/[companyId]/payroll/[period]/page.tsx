import { Title } from "@mantine/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft as ArrowLeft } from "@tabler/icons-react";
import { getPayrollLines } from "@/server/services/payroll";
import { Card, Empty } from "@/components/ui";
import { monthLabelSq } from "@/components/app/month-picker";
import { date, money } from "@/lib/format";

/** Detajet e listëpagesës së një muaji (E-SIG 025) siç janë në C@TS. */
export default async function PayrollMonthPage({ params }: { params: Promise<{ companyId: string; period: string }> }) {
  const { companyId, period } = await params;
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (!m) notFound();
  const year = Number(m[1]), month = Number(m[2]);
  const { lines, declarations } = await getPayrollLines(companyId, year, month);
  const d = declarations[0];
  const sum = (k: keyof (typeof lines)[number]) => lines.reduce((a, l) => a + Number(l[k] ?? 0), 0);
  const cell = "px-2 py-2 text-right tabular";

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <Link href={`/app/${companyId}/payroll`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"><ArrowLeft className="h-4 w-4" /> Listëpagesat</Link>
      <div>
        <Title order={2} fz={{ base: 20, sm: 24 }}>Listëpagesa · {monthLabelSq(year, month)}</Title>
        {d && (
          <p className="text-sm text-muted-foreground">
            {d.model} · dorëzuar {d.submitted_on ? date(d.submitted_on) : "—"} · afati {d.due_date ? date(d.due_date) : "—"} · {d.cats_status ?? ""}
          </p>
        )}
      </div>

      {d && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="p-3"><div className="text-xs text-muted-foreground">Sig. shoqërore</div><div className="text-lg font-semibold tabular">{money(d.social, "ALL", 0)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Sig. shëndetësore</div><div className="text-lg font-semibold tabular">{money(d.health, "ALL", 0)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">TAP</div><div className="text-lg font-semibold tabular">{money(d.income_tax, "ALL", 0)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Për pagesë</div><div className="text-lg font-semibold tabular text-warning">{money(Number(d.social) + Number(d.health) + Number(d.income_tax), "ALL", 0)}</div></Card>
        </div>
      )}

      {lines.length === 0 ? (
        <Empty title="Pa detaje për punonjësit." hint="Në e-Filing hap “Shfaq Detajet” për këtë muaj, kliko “Eksporto në Excel” dhe ngarkoje te faqja Listëpagesa." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-3 py-2">[9] NID · [10] Emri</th>
                <th className="px-2 py-2 text-right">[14] Ditë</th>
                <th className="px-2 py-2 text-right">[15] Bruto</th>
                <th className="px-2 py-2 text-right">[16] Baza shoq.</th>
                <th className="px-2 py-2 text-right">[17] Punëdh.</th>
                <th className="px-2 py-2 text-right">[18] Punëm.</th>
                <th className="px-2 py-2 text-right">[24] Baza shënd.</th>
                <th className="px-2 py-2 text-right">[25] Shëndet.</th>
                <th className="px-2 py-2 text-right">[28] Baza TAP</th>
                <th className="px-2 py-2 text-right">[29] TAP</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.full_name}</div>
                    <div className="text-[11px] text-muted-foreground"><span className="font-mono">{l.nid}</span>{l.profession ? ` · ${l.profession}` : ""}</div>
                  </td>
                  <td className={cell}>{l.days_worked ?? ""}</td>
                  <td className={cell}>{money(l.gross, "ALL", 0)}</td>
                  <td className={cell}>{money(l.social_base, "ALL", 0)}</td>
                  <td className={cell}>{money(l.social_employer, "ALL", 0)}</td>
                  <td className={cell}>{money(l.social_employee, "ALL", 0)}</td>
                  <td className={cell}>{money(l.health_base, "ALL", 0)}</td>
                  <td className={cell}>{money(l.health_total, "ALL", 0)}</td>
                  <td className={cell}>{money(l.tax_base, "ALL", 0)}</td>
                  <td className={cell}>{money(l.income_tax, "ALL", 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-border bg-muted/50 text-xs font-medium">
              <tr>
                <td className="px-3 py-2">Totali ({lines.length})</td>
                <td />
                <td className={cell}>{money(sum("gross"), "ALL", 0)}</td>
                <td className={cell}>{money(sum("social_base"), "ALL", 0)}</td>
                <td className={cell}>{money(sum("social_employer"), "ALL", 0)}</td>
                <td className={cell}>{money(sum("social_employee"), "ALL", 0)}</td>
                <td className={cell}>{money(sum("health_base"), "ALL", 0)}</td>
                <td className={cell}>{money(sum("health_total"), "ALL", 0)}</td>
                <td className={cell}>{money(sum("tax_base"), "ALL", 0)}</td>
                <td className={cell}>{money(sum("income_tax"), "ALL", 0)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </div>
  );
}
