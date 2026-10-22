import Link from "next/link";
import { Download, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPayroll } from "@/server/services/payroll";
import { Badge, Card, CardTitle, Empty } from "@/components/ui";
import { MonthPicker, monthLabelSq, parsePeriod } from "@/components/app/month-picker";
import { date, money } from "@/lib/format";
import { PayrollActions, PayrollTable, type Line } from "./payroll-client";

/**
 * Listëpagesa mujore (E-SIG 025): llogaritja nga rregullat tatimore të konfirmuara,
 * shumat për pagesë dhe afati i deklarimit; finalizimi krijon detyrimet orientuese.
 */
export default async function PayrollPage({ params, searchParams }: { params: Promise<{ companyId: string }>; searchParams: Promise<{ period?: string }> }) {
  const { companyId } = await params;
  const { year, month } = parsePeriod((await searchParams).period);
  const supabase = await createClient();
  const [{ run, lines }, { data: perms }, { count: employeeCount }, { data: decl }] = await Promise.all([
    getPayroll(companyId, year, month),
    supabase.rpc("my_permissions", { p_company_id: companyId }),
    supabase.from("employees").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("tax_declarations_view").select("due_date, status, effective_status").eq("company_id", companyId).eq("kind", "payroll_esig25").eq("year", year).eq("month", month).maybeSingle(),
  ]);
  const can = (a: string) => (perms ?? []).some((p) => p.module === "payroll" && p.action === a);
  const t = run?.totals ?? {};
  const pk = `${year}-${String(month).padStart(2, "0")}`;
  const rows: Line[] = lines.map((l) => ({
    id: l.id, days_worked: l.days_worked, gross: Number(l.gross), social_base: Number(l.social_base),
    social_employee: Number(l.social_employee), social_employer: Number(l.social_employer),
    health_employee: Number(l.health_employee), health_employer: Number(l.health_employer),
    income_tax: Number(l.income_tax), net: Number(l.net),
    name: `${l.employees?.first_name ?? ""} ${l.employees?.last_name ?? ""}`.trim(),
    personal_no: l.employees?.personal_no ?? null, kind: l.employees?.kind ?? "employee", position: l.employees?.position ?? null,
  }));

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Listëpagesa · {monthLabelSq(year, month)}</h1>
          {run && <Badge tone={run.status === "final" ? "success" : "warning"}>{run.status === "final" ? "e finalizuar" : "draft"}</Badge>}
        </div>
        <div className="no-print flex items-center gap-2">
          <MonthPicker year={year} month={month} basePath={`/app/${companyId}/payroll`} />
          <Link href={`/app/${companyId}/payroll/employees`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-sm hover:bg-muted"><Users className="h-4 w-4" /> Punonjësit ({employeeCount ?? 0})</Link>
          {run && <a href={`/app/${companyId}/payroll/export?period=${pk}`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-sm hover:bg-muted"><Download className="h-4 w-4" /> CSV</a>}
        </div>
      </div>

      <PayrollActions companyId={companyId} year={year} month={month} runId={run?.id ?? null} status={run?.status ?? null} canWrite={can("write")} canApprove={can("approve")} />

      {!run ? (
        <Empty
          title={employeeCount ? "Listëpagesa e këtij muaji nuk është përgatitur." : "Ende pa punonjës."}
          hint={employeeCount ? "Kliko “Përgatit listëpagesën”: merren punonjësit aktivë dhe llogariten kontributet dhe TAP." : "Shto punonjësit (dhe pronarin, nëse paguan kontribute si i vetëpunësuar) te “Punonjësit”."}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="p-3"><div className="text-xs text-muted-foreground">Fondi i pagave (bruto)</div><div className="text-lg font-semibold tabular">{money(t.gross ?? 0, "ALL", 0)}</div><div className="text-xs text-muted-foreground">{t.employees ?? 0} persona</div></Card>
            <Card className="p-3"><div className="text-xs text-muted-foreground">Kontribute (shoq. + shënd.)</div><div className="text-lg font-semibold tabular">{money((t.social_employee ?? 0) + (t.social_employer ?? 0) + (t.health_employee ?? 0) + (t.health_employer ?? 0), "ALL", 0)}</div></Card>
            <Card className="p-3"><div className="text-xs text-muted-foreground">TAP</div><div className="text-lg font-semibold tabular">{money(t.income_tax ?? 0, "ALL", 0)}</div></Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Për pagesë në DPT</div>
              <div className="text-lg font-semibold tabular text-warning">{money(t.to_pay ?? 0, "ALL", 0)}</div>
              {decl?.due_date && <div className="text-xs text-muted-foreground">afati {date(decl.due_date)}{decl.effective_status === "declared" ? " · deklaruar" : decl.effective_status === "late" ? " · me vonesë" : ""}</div>}
            </Card>
          </div>
          <PayrollTable companyId={companyId} lines={rows} editable={can("write") && run.status === "draft"} />
          <Card>
            <CardTitle>Si llogaritet</CardTitle>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>Sigurimet shoqërore: mbi pagën bruto, jo më pak se paga minimale dhe jo më shumë se paga maksimale e muajit.</li>
              <li>Sigurimet shëndetësore: mbi pagën bruto (minimumi paga minimale).</li>
              <li>TAP: sipas shkallëve të tatimit mbi pagën; pronari i vetëpunësuar paguan kontributet si i vetëpunësuar, pa TAP.</li>
              <li>Të gjitha normat dhe pragjet lexohen nga Rregullat tatimore për muajin e listëpagesës; shumat rrumbullakohen në lekë.</li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
