/**
 * Leximi i eksporteve Excel të e-Filing (C@TS) për listëpagesat — logjikë e pastër mbi një
 * tabelë qelizash (string[][]), e pavarur nga formati i skedarit (xlsx / HTML-xls / CSV).
 *
 *  1) "Listëpagesa të Dorëzuara": një rresht për muaj
 *     Periudha | Data e Dorëzimit | Data e Pritshme e Deklaratës | Nr. i Punëmarrësve | Pagat |
 *     Kontributet e Sigurimeve Shoqërore | … Shëndetësore | Totali i TAP | Model | Statusi |
 *     Statusi i Dërgimit në ISSH | Data e Dërgimit në ISSH
 *  2) "Shfaq Detajet" (E-SIG 025): një rresht për punonjës me fushat [9]–[31]
 */

export type Grid = string[][];

export type SummaryRow = {
  year: number; month: number; model: string; submitted_on: string | null; due_date: string | null;
  employees: number; gross: number; social: number; health: number; income_tax: number;
  cats_status: string | null; issh_status: string | null; issh_sent_on: string | null;
};

export type LineRow = {
  nid: string; full_name: string | null; profession: string | null; category: string | null;
  days_absent: number; days_worked: number; gross: number; social_base: number; social_employer: number;
  social_employee: number; social_total: number; supp_employer: number; supp_employee: number; supp_total: number;
  social_all: number; health_base: number; health_total: number; pension_voluntary: number; tax_deduction: number;
  tax_base: number; income_tax: number; personal_status: string | null; notes: string | null;
};

const MONTHS: Record<string, number> = {
  janar: 1, shkurt: 2, mars: 3, prill: 4, maj: 5, qershor: 6, korrik: 7, gusht: 8, shtator: 9, tetor: 10, nentor: 11, nëntor: 11, dhjetor: 12,
};

const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const low = (s: unknown) => norm(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** "2026 Shtator" | "Shtator 2026" | "09/2026" | "2026-09" → {year, month} */
export function parsePeriod(s: string): { year: number; month: number } | null {
  const t = low(s);
  const y = t.match(/(20\d{2})/)?.[1];
  if (!y) return null;
  for (const [name, m] of Object.entries(MONTHS)) {
    if (t.includes(name.normalize("NFD").replace(/[̀-ͯ]/g, ""))) return { year: Number(y), month: m };
  }
  const num = t.match(/(?:^|\D)(0?[1-9]|1[0-2])\s*[/.-]\s*20\d{2}|20\d{2}\s*[/.-]\s*(0?[1-9]|1[0-2])(?:\D|$)/);
  const m = Number(num?.[1] ?? num?.[2]);
  return m ? { year: Number(y), month: m } : null;
}

/** "11,500" | "11.500,00" | "1 234.5" | "0" → number (thousands me presje te e-Filing) */
export function parseNum(s: unknown): number {
  let t = norm(s).replace(/\s/g, "");
  if (!t || t === "-") return 0;
  const neg = /^-|^\(.*\)$/.test(t);
  t = t.replace(/[^0-9.,]/g, "");
  const lastComma = t.lastIndexOf(","), lastDot = t.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // ndarësi i fundit është dhjetori
    t = lastComma > lastDot ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (lastComma > -1) {
    // vetëm presje: dhjetore nëse pas saj ka 1–2 shifra, ndryshe mijëshe
    t = /,\d{1,2}$/.test(t) ? t.replace(/,(?=\d{3}\b)/g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (lastDot > -1) {
    // vetëm pika: mijëshe kur ka disa pika ose saktësisht 3 shifra pas saj ("1.500.000", "11.500"); ndryshe dhjetore
    const dots = (t.match(/\./g) ?? []).length;
    if (dots > 1 || /\.\d{3}$/.test(t)) t = t.replace(/\./g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
}

/** "01.10.2026" | "1/10/2026" | "2026-10-01" → "2026-10-01" */
export function parseDate(s: unknown): string | null {
  const t = norm(s);
  let m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function findHeader(grid: Grid, test: (cells: string[]) => boolean): number {
  return grid.findIndex((r) => test(r.map(low)));
}

/** Lloji i eksportit. */
export function detectKind(grid: Grid): "summary" | "lines" | null {
  if (findHeader(grid, (c) => c.some((x) => x.startsWith("periudha")) && c.some((x) => x.includes("pagat")) && c.some((x) => x.includes("shoqerore"))) >= 0) return "summary";
  if (findHeader(grid, (c) => c.some((x) => x.includes("[15]") || x.includes("paga totale bruto")) || (c.some((x) => x.includes("[9]")) && c.some((x) => x.includes("[29]")))) >= 0) return "lines";
  if (grid.some((r) => r.some((x) => /^[a-z]\d{8}[a-z]$/i.test(norm(x))))) return "lines";
  return null;
}

export function parseSummary(grid: Grid): SummaryRow[] {
  const h = findHeader(grid, (c) => c.some((x) => x.startsWith("periudha")) && c.some((x) => x.includes("pagat")));
  if (h < 0) return [];
  const head = grid[h].map(low);
  const col = (pred: (x: string) => boolean) => head.findIndex(pred);
  const c = {
    period: col((x) => x.startsWith("periudha")),
    submitted: col((x) => x.includes("dorezimit")),
    due: col((x) => x.includes("pritshme")),
    employees: col((x) => x.includes("punemarres")),
    gross: col((x) => x === "pagat" || x.startsWith("pagat")),
    social: col((x) => x.includes("shoqerore")),
    health: col((x) => x.includes("shendetesore")),
    tax: col((x) => x.includes("tatimit") || x.includes("tap")),
    model: col((x) => x === "model" || x.startsWith("model")),
    status: col((x) => x === "statusi"),
    issh: col((x) => x.includes("statusi i dergimit")),
    isshDate: col((x) => x.includes("data e dergimit")),
  };
  const out: SummaryRow[] = [];
  for (const r of grid.slice(h + 1)) {
    // Kolona e periudhës mund të ketë para saj "Shfaq Detajet" në HTML; kërkojmë në gjithë rreshtin si rezervë
    const p = parsePeriod(r[c.period] ?? "") ?? parsePeriod(r.slice(0, 3).join(" "));
    if (!p) continue;
    const get = (i: number) => (i >= 0 ? r[i] ?? "" : "");
    out.push({
      ...p,
      model: norm(get(c.model)) || "Normal",
      submitted_on: parseDate(get(c.submitted)),
      due_date: parseDate(get(c.due)),
      employees: Math.round(parseNum(get(c.employees))),
      gross: parseNum(get(c.gross)),
      social: parseNum(get(c.social)),
      health: parseNum(get(c.health)),
      income_tax: parseNum(get(c.tax)),
      cats_status: norm(get(c.status)) || null,
      issh_status: norm(get(c.issh)) || null,
      issh_sent_on: parseDate(get(c.isshDate)),
    });
  }
  return out;
}

const LINE_FIELDS: [number, keyof LineRow, string[]][] = [
  [9, "nid", ["numri personal"]],
  [10, "full_name", ["emri i plote"]],
  [11, "profession", ["detyra", "profesioni"]],
  [12, "category", ["kategorise se punemarresit", "numri i kategorise"]],
  [13, "days_absent", ["pa punuar"]],
  [14, "days_worked", ["te punuara"]],
  [15, "gross", ["paga totale bruto"]],
  [16, "social_base", ["sigurimeve shoqerore"]],
  [17, "social_employer", ["shoqerore te detyrueshme te punedhenesit"]],
  [18, "social_employee", ["shoqerore te detyrueshme te punemarresit"]],
  [19, "social_total", ["total contributions for compulsory"]],
  [20, "supp_employer", ["suplementare te punedhenesit"]],
  [21, "supp_employee", ["suplementare te punemarresit"]],
  [22, "supp_total", ["totali i kontributeve suplementare"]],
  [23, "social_all", ["total of contributions for social"]],
  [24, "health_base", ["sigurimeve shendetesore"]],
  [25, "health_total", ["shendetesore gjithsej"]],
  [26, "pension_voluntary", ["pensionit vullnetar"]],
  [27, "tax_deduction", ["zbritja tatimore"]],
  [28, "tax_base", ["baza tatimore"]],
  [29, "income_tax", ["(tap) gjithsej", "tatimi mbi te ardhurat nga punesimi"]],
  [30, "personal_status", ["statusit personal"]],
  [31, "notes", ["shenime"]],
];
const TEXT_FIELDS = new Set<keyof LineRow>(["nid", "full_name", "profession", "category", "personal_status", "notes"]);

export function parseLines(grid: Grid): LineRow[] {
  // Rreshti i kokës: qelizat "[9]" … "[29]" ose emërtimet e plota
  const h = findHeader(grid, (c) => c.filter((x) => /^\[\d{1,2}\]/.test(x)).length >= 8 || (c.some((x) => x.includes("numri personal")) && c.some((x) => x.includes("bruto"))));
  const idx = new Map<keyof LineRow, number>();
  if (h >= 0) {
    const head = grid[h].map(low);
    for (const [num, key, names] of LINE_FIELDS) {
      let i = head.findIndex((x) => x.startsWith(`[${num}]`));
      if (i < 0) i = head.findIndex((x) => names.some((n) => x.includes(n)));
      if (i >= 0 && ![...idx.values()].includes(i)) idx.set(key, i);
    }
  }
  const start = h >= 0 ? h + 1 : 0;
  const out: LineRow[] = [];
  for (const r of grid.slice(start)) {
    // NID mund të jetë në kolonën e caktuar ose (pa kokë) qeliza e parë që i ngjan formatit
    let nidIdx = idx.get("nid") ?? -1;
    if (!/^[a-z]\d{8}[a-z]$/i.test(norm(r[nidIdx]))) nidIdx = r.findIndex((x) => /^[a-z]\d{8}[a-z]$/i.test(norm(x)));
    if (nidIdx < 0) continue;
    const off = (idx.get("nid") ?? nidIdx) - nidIdx; // zhvendosje kur rreshti ka/s'ka "Shfaq Detajet"
    const row = {} as Record<keyof LineRow, string | number | null>;
    for (const [num, key] of LINE_FIELDS) {
      const i = idx.has(key) ? (idx.get(key) as number) - off : nidIdx + (num - 9);
      const v = r[i];
      row[key] = TEXT_FIELDS.has(key) ? (norm(v) || null) : parseNum(v);
    }
    row.nid = norm(r[nidIdx]).toUpperCase();
    out.push(row as unknown as LineRow);
  }
  return out;
}

/** Periudha e shkruar diku në skedarin e detajeve (p.sh. "Periudha e Deklarimit … 2026 Shtator"). */
export function findPeriodInGrid(grid: Grid): { year: number; month: number } | null {
  for (const r of grid.slice(0, 20)) {
    const t = r.join(" ");
    if (/periudha/i.test(t)) {
      const p = parsePeriod(t.replace(/periudha[^0-9a-z]*e?\s*(deklarimit|dorezimit|dorëzimit)?/gi, " "));
      if (p) return p;
    }
  }
  return null;
}
