import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = ["Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor", "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor"];

export function monthLabelSq(year: number, month: number) {
  return `${MONTHS[month - 1]} ${year}`;
}

/** Parsimi i ?period=YYYY-MM me default muajin e kaluar (periudha që deklarohet tani). */
export function parsePeriod(period?: string) {
  const m = period?.match(/^(\d{4})-(\d{2})$/);
  if (m) return { year: Number(m[1]), month: Number(m[2]) };
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function MonthPicker({ year, month, basePath }: { year: number; month: number; basePath: string }) {
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const fmt = (p: { year: number; month: number }) => `${basePath}?period=${p.year}-${String(p.month).padStart(2, "0")}`;
  return (
    <div className="flex items-center gap-2">
      <Link href={fmt(prev)} className="rounded-lg border border-border p-1.5 hover:bg-muted" aria-label="Muaji i mëparshëm"><ChevronLeft className="h-4 w-4" /></Link>
      <span className="min-w-36 text-center text-sm font-medium">{monthLabelSq(year, month)}</span>
      <Link href={fmt(next)} className="rounded-lg border border-border p-1.5 hover:bg-muted" aria-label="Muaji pasardhës"><ChevronRight className="h-4 w-4" /></Link>
    </div>
  );
}
