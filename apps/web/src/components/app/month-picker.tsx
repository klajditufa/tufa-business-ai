
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

export { MonthPicker } from "./month-picker-control";
