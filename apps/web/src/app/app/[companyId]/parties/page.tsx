import Link from "next/link";
import { Search } from "lucide-react";
import { getCompany } from "@/server/services/companies";
import { listPartyBalances } from "@/server/services/parties";
import { Badge, Card, Empty } from "@/components/ui";
import { date, money } from "@/lib/format";

/**
 * Klientët / Furnitorët: gjendja e secilës palë nga faturat (faturuar, paguar, mbetja, vonesa).
 * Burimi: party_balances (RLS aktive). Palët krijohen automatikisht nga NIPT-i i faturave.
 */
export default async function PartiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ type?: string; q?: string; show?: string }>;
}) {
  const { companyId } = await params;
  const sp = await searchParams;
  const direction = sp.type === "suppliers" ? "purchase" : "sale";
  const typeParam = direction === "sale" ? "customers" : "suppliers";
  const q = (sp.q ?? "").trim().toLowerCase();
  const showAll = sp.show === "all";
  const [company, { data, error }] = await Promise.all([getCompany(companyId), listPartyBalances(companyId, direction)]);
  const currency = company?.base_currency ?? "ALL";

  const all = data ?? [];
  const filtered = all
    .filter((p) => showAll || Math.abs(Number(p.outstanding)) >= 0.01)
    .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.nipt ?? "").toLowerCase().includes(q));
  const totalOutstanding = all.reduce((a, p) => a + Number(p.outstanding), 0);
  const overdue = all.filter((p) => Number(p.outstanding) > 0 && (p.days_overdue ?? 0) > 30);
  const base = `/app/${companyId}/parties`;
  const tab = (t: "customers" | "suppliers", label: string) => (
    <Link href={`${base}?type=${t}`} className={`rounded-lg px-3 py-1.5 ${typeParam === t ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{label}</Link>
  );

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Klientët &amp; Furnitorët</h1>
        <div className="flex gap-2 text-sm">{tab("customers", "Klientët")}{tab("suppliers", "Furnitorët")}</div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{direction === "sale" ? "Na detyrohen gjithsej" : "U detyrohemi gjithsej"}</div>
          <div className="text-lg font-semibold tabular">{money(totalOutstanding, currency)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{direction === "sale" ? "Klientë me mbetje" : "Furnitorë me mbetje"}</div>
          <div className="text-lg font-semibold tabular">{all.filter((p) => Number(p.outstanding) > 0.009).length} / {all.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Me vonesë &gt; 30 ditë</div>
          <div className={`text-lg font-semibold tabular ${overdue.length ? "text-warning" : ""}`}>
            {overdue.length} · {money(overdue.reduce((a, p) => a + Number(p.outstanding), 0), currency, 0)}
          </div>
        </Card>
      </div>

      <form method="get" action={base} className="flex flex-wrap items-center gap-2 text-sm">
        <input type="hidden" name="type" value={typeParam} />
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Emër ose NIPT…" className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3" />
        </div>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="show" value="all" defaultChecked={showAll} /> përfshi edhe ata pa mbetje
        </label>
        <button type="submit" className="h-9 rounded-lg bg-muted px-3 hover:bg-border">Filtro</button>
      </form>

      {error && <p className="text-sm text-danger">{error.message}</p>}

      {filtered.length === 0 ? (
        <Empty
          title={all.length === 0 ? "Ende pa palë." : "Asnjë palë me mbetje për këta filtra."}
          hint={all.length === 0 ? "Klientët dhe furnitorët krijohen vetë nga NIPT-i i faturave të sinkronizuara." : "Shëno “përfshi edhe ata pa mbetje” për t'i parë të gjithë."}
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">{direction === "sale" ? "Klienti" : "Furnitori"}</th>
                <th className="px-4 py-2 text-right">Fatura</th>
                <th className="px-4 py-2 text-right">Faturuar</th>
                <th className="px-4 py-2 text-right">Paguar</th>
                <th className="px-4 py-2 text-right">Mbetja</th>
                <th className="px-4 py-2">E papaguar më e vjetër</th>
                <th className="px-4 py-2">Fatura e fundit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const out = Number(p.outstanding);
                const late = p.days_overdue ?? 0;
                const inner = (
                  <>
                    <div className="font-medium">{p.name}</div>
                    {p.nipt && <div className="font-mono text-[11px] text-muted-foreground">{p.nipt}</div>}
                  </>
                );
                return (
                  <tr key={(p.party_id ?? "") + p.name} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-2">
                      {p.party_id ? <Link href={`${base}/${p.party_id}?type=${typeParam}`} className="hover:underline">{inner}</Link> : inner}
                    </td>
                    <td className="px-4 py-2 text-right tabular">{p.invoices}</td>
                    <td className="px-4 py-2 text-right tabular">{money(p.invoiced, currency)}</td>
                    <td className="px-4 py-2 text-right tabular">{money(p.paid, currency)}</td>
                    <td className={`px-4 py-2 text-right font-semibold tabular ${out > 0.009 ? "" : "text-muted-foreground"}`}>{money(out, currency)}</td>
                    <td className="px-4 py-2">
                      {p.oldest_unpaid ? (
                        <span className="whitespace-nowrap">
                          {date(p.oldest_unpaid)}{" "}
                          {late > 0 && <Badge tone={late > 60 ? "danger" : late > 30 ? "warning" : "neutral"}>{late} ditë</Badge>}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 tabular">{p.last_invoice ? date(p.last_invoice) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">
        Mbetja = faturuar − paguar, sipas pagesave të shënuara në regjistër. Ditët e vonesës llogariten nga afati i pagesës (ose data e faturës kur afati mungon).
      </p>
    </div>
  );
}
