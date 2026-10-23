"use client";

import { useState } from "react";
import Link from "next/link";
import { Box, Download, Landmark, List, Search } from "lucide-react";
import type { InvoiceFilters } from "@/server/services/invoices";
import { cn } from "@/lib/utils";

type Preset = "thisMonth" | "lastMonth" | "thisQuarter" | "thisYear" | "lastYear" | "all" | "custom";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function presetRange(p: Preset, today = new Date()): { from: string; to: string } | null {
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (p) {
    case "thisMonth":
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case "lastMonth":
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case "thisQuarter": {
      const q = Math.floor(m / 3) * 3;
      return { from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) };
    }
    case "thisYear":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "lastYear":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default:
      return null;
  }
}

const PRESETS: [Preset, string][] = [
  ["thisMonth", "Ky muaj"],
  ["lastMonth", "Muaji i kaluar"],
  ["thisQuarter", "Ky tremujor"],
  ["thisYear", "Ky vit"],
  ["lastYear", "Viti i kaluar"],
  ["all", "Të gjitha"],
  ["custom", "Periudhë tjetër"],
];

function detect(range: { from: string; to: string } | null): Preset {
  if (!range) return "all";
  for (const [p] of PRESETS) {
    const r = presetRange(p);
    if (r && r.from === range.from && r.to === range.to) return p;
  }
  return "custom";
}

/**
 * Filtrat e faturave në stilin e cis-client-2: kartë me periudhën (Nga / Deri) dhe rresht me
 * kërkimin, llojin, statusin e pagesës dhe eksportet. Formë GET: URL-ja mbetet e ndashme.
 */
export function InvoiceFilterBar({
  basePath,
  itemsHref,
  f,
  range,
}: {
  basePath: string;
  itemsHref: string;
  f: InvoiceFilters;
  range: { from: string; to: string } | null;
}) {
  const [preset, setPreset] = useState<Preset>(detect(range));
  const [from, setFrom] = useState(range?.from ?? "");
  const [to, setTo] = useState(range?.to ?? "");
  const choose = (p: Preset) => {
    setPreset(p);
    const r = presetRange(p);
    if (r) {
      setFrom(r.from);
      setTo(r.to);
    } else if (p === "all") {
      setFrom("");
      setTo("");
    }
  };
  const exportQs = new URLSearchParams();
  exportQs.set("direction", f.direction);
  if (range) {
    exportQs.set("from", range.from);
    exportQs.set("to", range.to);
  } else exportQs.set("period", "all");
  for (const k of ["q", "status", "kind"] as const) {
    const v = f[k];
    if (v && v !== "all") exportQs.set(k, v);
  }
  const field = "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-accent/40";
  const lbl = "mb-1 block text-sm font-semibold";

  return (
    <div className="space-y-4">
      <form method="get" action={basePath} className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <input type="hidden" name="direction" value={f.direction} />
        {preset === "all" && <input type="hidden" name="period" value="all" />}
        <div className="sm:col-span-2 lg:col-span-1">
          <label className={lbl} htmlFor="inv-preset">Periudha</label>
          <select id="inv-preset" className={field} value={preset} onChange={(e) => choose(e.target.value as Preset)}>
            {PRESETS.map(([p, label]) => (
              <option key={p} value={p}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl} htmlFor="inv-from">Nga</label>
          <input id="inv-from" type="date" name={preset === "all" ? undefined : "from"} className={field} value={from} disabled={preset === "all"} onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }} />
        </div>
        <div>
          <label className={lbl} htmlFor="inv-to">Deri</label>
          <input id="inv-to" type="date" name={preset === "all" ? undefined : "to"} className={field} value={to} min={from || undefined} disabled={preset === "all"} onChange={(e) => { setTo(e.target.value); setPreset("custom"); }} />
        </div>
        <button type="submit" className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:col-span-2 lg:col-span-1">
          Shfaq faturat
        </button>
      </form>

      <form method="get" action={basePath} className="flex flex-wrap items-center gap-2 text-sm">
        <input type="hidden" name="direction" value={f.direction} />
        {range ? (
          <>
            <input type="hidden" name="from" value={range.from} />
            <input type="hidden" name="to" value={range.to} />
          </>
        ) : (
          <input type="hidden" name="period" value="all" />
        )}
        <div className="inline-flex rounded-lg bg-muted p-1">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-card px-3 py-1.5 font-semibold shadow-sm">
            <List className="h-4 w-4" /> Faturat
          </span>
          <Link href={itemsHref} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground">
            <Box className="h-4 w-4" /> Sipas artikujve
          </Link>
        </div>
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input name="q" defaultValue={f.q ?? ""} placeholder="Filtro sipas numrit, NIPT-it, emrit ose NIVF" className={cn(field, "pl-9")} />
        </div>
        <select name="kind" defaultValue={f.kind ?? "all"} className={cn(field, "w-auto")} aria-label="Lloji">
          <option value="all">Të gjitha llojet</option>
          <option value="noncash">Pa para në dorë</option>
          <option value="cash">Me para në dorë</option>
          <option value="einvoice">E-faturë</option>
        </select>
        <select name="status" defaultValue={f.status ?? "all"} className={cn(field, "w-auto")} aria-label="Pagesa">
          <option value="all">Çdo pagesë</option>
          <option value="unpaid">Të papaguara</option>
          <option value="partial">Pjesërisht</option>
          <option value="paid">Të paguara</option>
        </select>
        <button type="submit" className="h-10 rounded-lg border border-border bg-card px-4 font-semibold hover:bg-muted">Filtro</button>
        <div className="flex gap-2 sm:ml-auto">
          <a href={`${basePath}/export?${exportQs}`} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 font-semibold hover:bg-muted" title="Shkarko CSV me filtrat aktualë">
            <Download className="h-4 w-4" /> CSV
          </a>
          <Link href={`${basePath}/bank`} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 font-semibold hover:bg-muted" title="Shëno pagesat nga ekstrakti bankar">
            <Landmark className="h-4 w-4" /> Banka
          </Link>
        </div>
      </form>
    </div>
  );
}
