/**
 * Formatimi për përdoruesit shqiptarë: 1.234.567,89 LEK · 19.10.2026
 * Vlerat monetare vijnë si string nga Postgres (NUMERIC) — kurrë nuk bëjmë aritmetikë këtu.
 */
const nf = new Intl.NumberFormat("sq-AL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("sq-AL", { maximumFractionDigits: 0 });

export function money(value: string | number | null | undefined, currency = "ALL", decimals: 0 | 2 = 2) {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  const label = currency === "ALL" ? "LEK" : currency;
  return `${(decimals === 0 ? nf0 : nf).format(n)} ${label}`;
}

export function date(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("sq-AL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

export function monthLabel(value: string) {
  const d = new Date(value);
  return new Intl.DateTimeFormat("sq-AL", { month: "short", year: "2-digit" }).format(d);
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function monthRange(d = new Date()) {
  const from = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1));
  const to = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0));
  return { from: isoDate(from), to: isoDate(to) };
}
