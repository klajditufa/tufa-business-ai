/**
 * Formatimi për përdoruesit shqiptarë: 1.234.567,89 LEK · 19.10.2026
 * Vlerat monetare vijnë si string nga Postgres (NUMERIC) — kurrë nuk bëjmë aritmetikë këtu.
 */
/*
 * Një format i vetëm kudo, si te cis-client-2: shfletuesit nuk kanë të dhëna numerike shqip dhe bien
 * në formate të ndryshme, gjë që prish edhe përputhjen server ↔ shfletues. Prandaj formatohet me dorë:
 * 1,234,567.89 · 19/10/2026.
 */
function grouped(n: number, decimals: 0 | 2): string {
  const fixed = Math.abs(n).toFixed(decimals);
  const [whole, frac] = fixed.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = n < 0 && Number(fixed) !== 0 ? "-" : "";
  return sign + withCommas + (frac ? `.${frac}` : "");
}

export function money(value: string | number | null | undefined, currency = "ALL", decimals: 0 | 2 = 2) {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  const label = currency === "ALL" ? "LEK" : currency;
  return `${grouped(n, decimals)} ${label}`;
}

/** Shumë pa monedhë (kolonat e tabelave), si cis-client-2: 11,550.00 */
export function amount(value: string | number | null | undefined, decimals: 0 | 2 = 2) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? grouped(n, decimals) : "";
}

const pad = (n: number) => String(n).padStart(2, "0");

/** dd/mm/vvvv (pa konvertim zone për datat VVVV-MM-DD). */
export function date(value: string | Date | null | undefined) {
  if (!value) return "—";
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (m && value.length === 10) return `${m[3]}/${m[2]}/${m[1]}`;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`;
}

const SHORT_MONTHS = ["Jan", "Shk", "Mar", "Pri", "Maj", "Qer", "Kor", "Gus", "Sht", "Tet", "Nën", "Dhj"];

export function monthLabel(value: string) {
  const m = /^(\d{4})-(\d{2})/.exec(value);
  return m ? `${SHORT_MONTHS[Number(m[2]) - 1]} ${m[1].slice(2)}` : value;
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function monthRange(d = new Date()) {
  const from = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1));
  const to = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0));
  return { from: isoDate(from), to: isoDate(to) };
}
