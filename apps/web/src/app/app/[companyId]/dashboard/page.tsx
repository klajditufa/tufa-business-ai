import { IconLayoutDashboard as LayoutDashboard } from "@tabler/icons-react";
import { PageTitle } from "@/components/ui";
import Link from "next/link";
import { getCompany } from "@/server/services/companies";
import { getDashboardData } from "@/server/services/dashboard";
import { Alert, Badge, Card, CardTitle, Empty } from "@/components/ui";
import { MonthlyChart } from "./monthly-chart";
import { money, date } from "@/lib/format";
import { fmt, t } from "@/lib/i18n";

export default async function DashboardPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const [company, data] = await Promise.all([getCompany(companyId), getDashboardData(companyId)]);
  const d = t();
  const tv = data.turnover;
  const currency = company?.base_currency ?? "ALL";
  const hasData = (data.series ?? []).some((m) => Number(m.sales_net) !== 0 || Number(m.purchases_net) !== 0);

  const unpaidTotal = (data.obligations ?? []).reduce((acc, o) => acc + Number(o.amount_due ?? 0), 0);
  // Emrat e deklarimeve (nga enum) në shqip; afatet e kalendarit kanë titullin e tyre
  const KIND_LABEL: Record<string, string> = {
    vat: "Deklarata e TVSH-së", payroll_esig25: "Listëpagesa (E-SIG 025)", withholding: "Tatimi në burim",
    profit_tax: "Tatim fitimi", simplified: "Tatimi i thjeshtuar", annual_financial: "Pasqyrat vjetore", other: "Deklarim",
  };
  const label = (x: { title: string | null; source: string | null }) => (x.source === "declaration" ? KIND_LABEL[x.title ?? ""] ?? x.title : x.title) ?? "";
  const overdue = (data.deadlines ?? []).filter((x) => (x.days_left ?? 0) < 0);
  const urgent = (data.deadlines ?? []).find((x) => (x.days_left ?? 99) >= 0 && (x.days_left ?? 99) <= 7);

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <PageTitle
        icon={LayoutDashboard}
        tone="indigo"
        title={fmt(d.dashboard.welcome, { name: company?.trade_name || company?.legal_name || "" })}
        subtitle={d.dashboard.thisMonth}
      />

      {data.errors.length > 0 && <Alert tone="danger">{data.errors.join(" · ")}</Alert>}
      {overdue.length > 0 && (
        <Alert tone="danger">
          ⚠️ Afat i kaluar pa u deklaruar:{" "}
          {overdue.map((x) => `${label(x)} (${date(x.due_date)}, ${-(x.days_left ?? 0)} ditë vonesë)`).join(" · ")}.{" "}
          <Link href={`/app/${companyId}/declarations`} className="underline">Hap deklarimet</Link>
        </Alert>
      )}
      {urgent && (
        <Alert tone="warning">
          ⚠️ {urgent.days_left === 0 ? `Sot është afati për: ${label(urgent)}` : fmt(d.dashboard.deadlineWarning, { title: label(urgent), days: urgent.days_left ?? 0 })}
        </Alert>
      )}

      <div className={`grid gap-4 sm:grid-cols-2 ${company?.vat_registered === false ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
        <Kpi title={d.dashboard.monthlyIncome} value={money(tv?.sales_net, currency)} sub={`${tv?.sales_count ?? 0} fatura`} />
        <Kpi title={d.dashboard.monthlyExpenses} value={money(tv?.purchases_net, currency)} sub={`${tv?.purchases_count ?? 0} fatura`} />
        {company?.vat_registered !== false && (
        <Kpi
          title={d.dashboard.vatBalance}
          value={money(tv?.vat_balance, currency)}
          sub={Number(tv?.vat_balance ?? 0) >= 0 ? "për pagesë · " + d.dashboard.estimate : "kreditim · " + d.dashboard.estimate}
          tone={Number(tv?.vat_balance ?? 0) > 0 ? "warning" : "success"}
        />
        )}
        <Kpi title={d.dashboard.unpaidObligations} value={money(unpaidTotal, currency)} sub={`${data.obligations?.length ?? 0} zëra`} tone={unpaidTotal > 0 ? "danger" : "success"} />
      </div>

      <p className="text-xs text-muted-foreground">
        {fmt(d.dashboard.source, { source: tv?.source ?? "invoices", from: date(data.period.from), to: date(data.period.to) })}
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>{d.dashboard.chartTitle}</CardTitle>
          <div className="mt-4 h-72">
            {hasData ? (
              <MonthlyChart data={data.series ?? []} currency={currency} />
            ) : (
              <Empty title={d.dashboard.noData} />
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardTitle>{d.dashboard.deadlines}</CardTitle>
            <ul className="mt-3 space-y-2 text-sm">
              {(data.deadlines ?? []).slice(0, 6).map((x, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="truncate">{label(x)}</span>
                  <span className="shrink-0 tabular text-muted-foreground">{date(x.due_date)}</span>
                  <Badge tone={(x.days_left ?? 99) <= 3 ? "danger" : (x.days_left ?? 99) <= 7 ? "warning" : "neutral"}>
                    {(x.days_left ?? 0) < 0 ? `vonesë ${-(x.days_left ?? 0)} d` : (x.days_left ?? 0) === 0 ? "sot" : `${x.days_left} d`}
                  </Badge>
                </li>
              ))}
              {(data.deadlines ?? []).length === 0 && <li className="text-muted-foreground">Asnjë afat në 30 ditët e ardhshme.</li>}
            </ul>
          </Card>

          <Card>
            <CardTitle>{d.dashboard.debtors}</CardTitle>
            <ul className="mt-3 space-y-2 text-sm">
              {(data.debtors ?? []).map((x, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  {x.customer_id ? (
                    <Link href={`/app/${companyId}/parties/${x.customer_id}?type=customers`} className="truncate hover:underline">{x.customer_name}</Link>
                  ) : (
                    <span className="truncate">{x.customer_name}</span>
                  )}
                  <span className="tabular font-medium">{money(x.outstanding, currency, 0)}</span>
                </li>
              ))}
              {(data.debtors ?? []).length === 0 && <li className="text-muted-foreground">Asnjë faturë e papaguar.</li>}
            </ul>
            <Link href={`/app/${companyId}/parties?type=customers`} className="mt-3 inline-block text-xs text-accent hover:underline">Të gjithë klientët →</Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({ title, value, sub, tone }: { title: string; value: string; sub?: string; tone?: "success" | "warning" | "danger" }) {
  const color = tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "";
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div className={`mt-2 text-2xl font-semibold tabular ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}
