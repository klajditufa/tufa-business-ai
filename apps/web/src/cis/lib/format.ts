// Browsers ship without Albanian number data and fall back unpredictably, so one format is used everywhere.
const amountFormat = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function money(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "";
  const number = Number(value);
  return Number.isFinite(number) ? amountFormat.format(number) : "";
}

export function quantity(value: string | number | undefined): string {
  const number = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(number)
    ? String(number)
    : String(value ?? "");
}

/** Whole cents, so sums do not drift. */
export const cents = (value: string | number | undefined): number => Math.round((Number(value) || 0) * 100);

const DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):?(\d{2})?)?/;

/** dd/mm/yyyy hh:mm, as CIS recorded it (no time zone conversion). */
export function formatDate(value: string | undefined | null, withTime = true): string {
  const match = DATE.exec(value || "");
  if (!match) return value || "";
  const day = `${match[3]}/${match[2]}/${match[1]}`;
  return withTime && match[4] ? `${day} ${match[4]}:${match[5]}` : day;
}

/** dd.mm.yyyy hh:mm:ss, as printed on invoices. */
export function documentDate(value: string | undefined | null, withTime = true): string {
  const match = DATE.exec(value || "");
  if (!match) return value || "";
  const day = `${match[3]}.${match[2]}.${match[1]}`;
  return withTime && match[4] ? `${day} ${match[4]}:${match[5]}:${match[6] || "00"}` : day;
}

export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type Preset = "today" | "yesterday" | "thisMonth" | "lastMonth" | "thisYear" | "custom";
export const PRESETS: Preset[] = ["today", "yesterday", "thisMonth", "lastMonth", "thisYear", "custom"];

export function presetRange(preset: Preset): [string, string] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "today":
      return [isoDay(now), isoDay(now)];
    case "yesterday": {
      const day = new Date(y, m, now.getDate() - 1);
      return [isoDay(day), isoDay(day)];
    }
    case "lastMonth":
      return [isoDay(new Date(y, m - 1, 1)), isoDay(new Date(y, m, 0))];
    case "thisYear":
      return [isoDay(new Date(y, 0, 1)), isoDay(new Date(y, 11, 31))];
    default:
      return [isoDay(new Date(y, m, 1)), isoDay(new Date(y, m + 1, 0))];
  }
}

export function isActive(validFrom?: string | null, validTo?: string | null): boolean {
  const today = isoDay(new Date());
  return (!validFrom || validFrom.slice(0, 10) <= today) && (!validTo || validTo.slice(0, 10) >= today);
}
