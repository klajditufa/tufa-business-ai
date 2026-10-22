import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import type { InvoiceFilters } from "@/server/services/invoices";
import { monthLabelSq } from "@/components/app/month-picker";

/** Filtrat e regjistrit (formë GET, pa JS): drejtimi, periudha, kërkimi, statusi, burimi + eksport CSV. */
export function InvoiceFilterBar({ basePath, f }: { basePath: string; f: InvoiceFilters }) {
  const period = f.period ?? "all";
  const qs = (over: Partial<Record<string, string | null | undefined>>) => {
    const p = new URLSearchParams();
    const all = { direction: f.direction, period, q: f.q, status: f.status, source: f.source, ...over };
    for (const [k, v] of Object.entries(all)) if (v && v !== "all") p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const shift = (delta: number) => {
    if (period === "all") return "all";
    const [y, m] = period.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const tab = (dir: "sale" | "purchase", label: string) => (
    <Link href={`${basePath}${qs({ direction: dir })}`} className={`rounded-lg px-3 py-1.5 ${f.direction === dir ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
      {label}
    </Link>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 text-sm">{tab("sale", "Shitjet")}{tab("purchase", "Blerjet")}</div>
        <div className="flex items-center gap-2">
          {period !== "all" ? (
            <>
              <Link href={`${basePath}${qs({ period: shift(-1) })}`} className="rounded-lg border border-border p-1.5 hover:bg-muted" aria-label="Muaji i mëparshëm"><ChevronLeft className="h-4 w-4" /></Link>
              <span className="min-w-32 text-center text-sm font-medium">{monthLabelSq(Number(period.slice(0, 4)), Number(period.slice(5, 7)))}</span>
              <Link href={`${basePath}${qs({ period: shift(1) })}`} className="rounded-lg border border-border p-1.5 hover:bg-muted" aria-label="Muaji pasardhës"><ChevronRight className="h-4 w-4" /></Link>
              <Link href={`${basePath}${qs({ period: "all" })}`} className="text-xs text-muted-foreground underline">të gjitha</Link>
            </>
          ) : (
            <Link href={`${basePath}${qs({ period: new Date().toISOString().slice(0, 7) })}`} className="text-xs text-muted-foreground underline">sipas muajit</Link>
          )}
        </div>
      </div>

      <form method="get" action={basePath} className="flex flex-wrap items-center gap-2 text-sm">
        <input type="hidden" name="direction" value={f.direction} />
        <input type="hidden" name="period" value={period} />
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            name="q"
            defaultValue={f.q ?? ""}
            placeholder={f.direction === "sale" ? "Klient, NIPT, nr. fature, NIVF…" : "Furnitor, NIPT, nr. fature, NIVF…"}
            className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3"
          />
        </div>
        <select name="status" defaultValue={f.status ?? "all"} className="h-9 rounded-lg border border-border bg-background px-2">
          <option value="all">Çdo status</option>
          <option value="unpaid">Të papaguara</option>
          <option value="partial">Pjesërisht</option>
          <option value="paid">Të paguara</option>
        </select>
        <select name="source" defaultValue={f.source ?? "all"} className="h-9 rounded-lg border border-border bg-background px-2">
          <option value="all">Çdo burim</option>
          <option value="connector">Fiskalizimi (CIS)</option>
          <option value="import">Import skedari</option>
          <option value="manual">Manuale</option>
        </select>
        <button type="submit" className="h-9 rounded-lg bg-muted px-3 hover:bg-border">Filtro</button>
        <a href={`${basePath}/export${qs({})}`} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 hover:bg-muted" title="Shkarko CSV me filtrat aktualë">
          <Download className="h-4 w-4" /> CSV
        </a>
      </form>
    </div>
  );
}
