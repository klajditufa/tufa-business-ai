/**
 * Artikujt e faturave CIS (fusha `Items` e faturës së plotë, që agjenti e dërgon si parazgjedhje).
 * Përshtatur nga cis-client-2 (`frontend/src/lib/items.ts`): rreshtat me të njëjtin emër
 * (pa dallim shkronjash/theksash) dhe njësi janë i njëjti artikull; kodet ndryshojnë sipas lëshuesit.
 * Shumat mblidhen në qindarka; faturat korrigjuese kanë rreshta negativë dhe i zbresin.
 */

export type CisItem = {
  N?: string; C?: string; U?: string; Q?: string; UPB?: string; UPA?: string; R?: string;
  PB?: string; VR?: string; VA?: string; PA?: string; EX?: string; IN?: string;
};

export type ItemSummary = {
  key: string;
  name: string;
  codes: string[];
  unit: string;
  quantity: number;
  net: number; // qindarka
  vat: number;
  total: number;
  invoices: number;
};

/** "123.45" → 12345; e pavlefshme → 0. Pa float në mbledhje. */
export function cents(value: unknown): number {
  const s = typeof value === "number" ? value.toFixed(2) : String(value ?? "").trim();
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) return 0;
  const frac = (m[3] ?? "").padEnd(3, "0");
  let c = Number(m[2]) * 100 + Number(frac.slice(0, 2)) + (Number(frac[2]) >= 5 ? 1 : 0);
  if (m[1]) c = -c;
  return c;
}

export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const UNIT_ALIASES: Record<string, string> = {
  cope: "copë", cop: "copë", c: "copë", pcs: "copë", piece: "copë", "h87": "copë",
  kg: "kg", kgm: "kg", kilogram: "kg",
  l: "litër", lit: "litër", liter: "litër", litra: "litër", ltr: "litër",
  m: "metër", mtr: "metër", m2: "m²", mtk: "m²", m3: "m³",
  sherbim: "shërbim", sh: "shërbim", muaj: "muaj", ore: "orë", h: "orë", hur: "orë",
};

export function unitLabel(u: string | undefined): string {
  const raw = (u ?? "").trim();
  if (!raw) return "—";
  return UNIT_ALIASES[fold(raw).replace(/\.$/, "")] ?? raw;
}

export function summariseItems(invoices: { id: string; items: CisItem[] }[]): ItemSummary[] {
  const groups = new Map<string, ItemSummary & { codeSet: Map<string, string>; invoiceSet: Set<string> }>();
  for (const inv of invoices) {
    for (const item of inv.items) {
      const unit = unitLabel(item.U);
      const key = `${fold(item.N ?? "")}\u0000${fold(unit)}`;
      let g = groups.get(key);
      if (!g) {
        g = { key, name: (item.N ?? "").trim() || "(pa emër)", codes: [], unit, quantity: 0, net: 0, vat: 0, total: 0, invoices: 0, codeSet: new Map(), invoiceSet: new Set() };
        groups.set(key, g);
      }
      const code = (item.C ?? "").trim();
      if (code && !g.codeSet.has(fold(code))) g.codeSet.set(fold(code), code);
      g.quantity += Number(item.Q) || 0;
      g.net += cents(item.PB);
      g.vat += cents(item.VA);
      g.total += cents(item.PA);
      g.invoiceSet.add(inv.id);
    }
  }
  return [...groups.values()]
    .map(({ codeSet, invoiceSet, ...g }) => ({ ...g, codes: [...codeSet.values()], quantity: Number(g.quantity.toFixed(6)), invoices: invoiceSet.size }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "sq"));
}

/** Artikujt nga `raw` i faturës (bosh nëse fatura u sinkronizua pa detaje). */
export function itemsOf(raw: unknown): CisItem[] | null {
  if (!raw || typeof raw !== "object") return null;
  const items = (raw as { Items?: unknown }).Items;
  if (!Array.isArray(items)) return null;
  return items.filter((i): i is CisItem => !!i && typeof i === "object");
}
