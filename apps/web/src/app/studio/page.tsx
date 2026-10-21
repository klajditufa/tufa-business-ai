import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Empty } from "@/components/ui";
import { KIND_LABELS, StatusBadge, type DeclStatus } from "@/components/app/status-badge";
import { StatusActions } from "@/components/app/status-actions";
import { MonthPicker, monthLabelSq, parsePeriod } from "@/components/app/month-picker";

/** Matrica subjekte × deklarime për një muaj, me butonin "Deklaro" dhe progresin mujor. */
export default async function StudioPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const { year, month } = parsePeriod(period);
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("studio_declaration_matrix", { p_year: year, p_month: month });

  type Row = NonNullable<typeof rows>[number];
  const kinds = Array.from(new Set((rows ?? []).map((r) => r.kind!))).sort();
  const companies = new Map<string, { name: string; nipt: string; cells: Map<string, Row> }>();
  for (const r of rows ?? []) {
    if (!companies.has(r.company_id!)) companies.set(r.company_id!, { name: r.company_name!, nipt: r.nipt!, cells: new Map() });
    companies.get(r.company_id!)!.cells.set(r.kind!, r);
  }
  const total = rows?.length ?? 0;
  const done = (rows ?? []).filter((r) => r.status === "declared").length;
  const late = (rows ?? []).filter((r) => r.effective_status === "late").length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Deklarimet · {monthLabelSq(year, month)}</h1>
        <MonthPicker year={year} month={month} basePath="/studio" />
      </div>
      {error && <p className="text-sm text-danger">{error.message}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><div className="text-sm text-muted-foreground">Progresi i muajit</div><div className="mt-1 text-2xl font-semibold tabular">{pct}%</div>
          <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-success" style={{ width: `${pct}%` }} /></div>
          <div className="mt-1 text-xs text-muted-foreground">{done} / {total} deklarime</div></Card>
        <Card><div className="text-sm text-muted-foreground">Me vonesë</div><div className={`mt-1 text-2xl font-semibold tabular ${late ? "text-danger" : "text-success"}`}>{late}</div></Card>
        <Card><div className="text-sm text-muted-foreground">Subjekte</div><div className="mt-1 text-2xl font-semibold tabular">{companies.size}</div></Card>
      </div>

      {companies.size === 0 ? (
        <Empty title="Asnjë subjekt." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Subjekti</th>
                {kinds.map((k) => <th key={k} className="px-4 py-2">{KIND_LABELS[k] ?? k}</th>)}
              </tr>
            </thead>
            <tbody>
              {Array.from(companies.entries()).map(([id, c]) => (
                <tr key={id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <Link href={`/app/${id}/declarations?period=${year}-${String(month).padStart(2, "0")}`} className="font-medium hover:underline">{c.name}</Link>
                    <div className="font-mono text-xs text-muted-foreground">{c.nipt}</div>
                  </td>
                  {kinds.map((k) => {
                    const cell = c.cells.get(k);
                    if (!cell) return <td key={k} className="px-4 py-3 text-xs text-muted-foreground">—</td>;
                    return (
                      <td key={k} className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <StatusBadge status={cell.effective_status as DeclStatus} />
                          <StatusActions id={cell.declaration_id!} current={cell.status!} compact revalidate="/studio" />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
