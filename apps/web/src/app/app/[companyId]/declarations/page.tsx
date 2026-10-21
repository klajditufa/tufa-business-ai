import { createClient } from "@/lib/supabase/server";
import { Card, Empty } from "@/components/ui";
import { KIND_LABELS, StatusBadge, type DeclStatus } from "@/components/app/status-badge";
import { StatusActions } from "@/components/app/status-actions";
import { MonthPicker, parsePeriod } from "@/components/app/month-picker";
import { date } from "@/lib/format";
import { t } from "@/lib/i18n";

/**
 * Deklarimet e subjektit për një muaj. Kontabilisti ndryshon statuset; klienti i sheh.
 * Rreshtat krijohen automatikisht sipas regjimit (ensure_declarations) kur hapet muaji.
 */
export default async function DeclarationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { companyId } = await params;
  const { period } = await searchParams;
  const { year, month } = parsePeriod(period);
  const d = t();
  const supabase = await createClient();

  const [{ data: rows, error }, { data: perms }, { data: history }] = await Promise.all([
    supabase.rpc("ensure_declarations", { p_company_id: companyId, p_year: year, p_month: month }),
    supabase.rpc("my_permissions", { p_company_id: companyId }),
    supabase
      .from("tax_declarations_view")
      .select("id, kind, effective_status, due_date, declared_at, year, month")
      .eq("company_id", companyId)
      .order("due_date", { ascending: false })
      .limit(24),
  ]);
  const canWrite = (perms ?? []).some((p) => p.module === "declarations" && p.action === "write");
  const basePath = `/app/${companyId}/declarations`;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{d.nav.declarations}</h1>
        <MonthPicker year={year} month={month} basePath={basePath} />
      </div>
      {error && <p className="text-sm text-danger">{error.message}</p>}

      {!rows || rows.length === 0 ? (
        <Empty title="Asnjë deklarim për këtë periudhë." hint="Deklarimet krijohen nga kontabilisti sipas regjimit tatimor të subjektit." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const eff: DeclStatus = r.status !== "declared" && r.due_date < today ? "late" : (r.status as DeclStatus);
            return (
              <Card key={r.id} className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{KIND_LABELS[r.kind] ?? r.kind}</div>
                    <div className="text-xs text-muted-foreground">Afati: {date(r.due_date)}</div>
                  </div>
                  <StatusBadge status={eff} />
                </div>
                {r.declared_at && <p className="text-xs text-success">Deklaruar më {date(r.declared_at)}</p>}
                {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
                {canWrite && <StatusActions id={r.id} current={r.status} revalidate={basePath} />}
              </Card>
            );
          })}
        </div>
      )}

      {history && history.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <div className="px-4 py-3 text-sm font-medium">Historiku</div>
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-2">Periudha</th><th className="px-4 py-2">Deklarimi</th><th className="px-4 py-2">Afati</th><th className="px-4 py-2">Statusi</th></tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id!} className="border-t border-border">
                  <td className="px-4 py-2 tabular">{String(h.month).padStart(2, "0")}/{h.year}</td>
                  <td className="px-4 py-2">{KIND_LABELS[h.kind!] ?? h.kind}</td>
                  <td className="px-4 py-2 tabular">{date(h.due_date)}</td>
                  <td className="px-4 py-2"><StatusBadge status={h.effective_status as DeclStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
