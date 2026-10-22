/**
 * Leximi i ekstraktit bankar (PDF → tekst me pozicione → transaksione).
 * Logjikë e pastër, pa DB dhe pa rrjet: ekzekutohet në browser, skedari nuk ngarkohet në server.
 *
 * Formati i testuar: "NXJERRJE LLOGARIE" (data | përshkrim | datë valute | debi | kredi | balancë,
 * blloqe që mbyllen me "Referenca …"). Drejtimi i lëvizjes (hyrje/dalje) nxirret nga ndryshimi i
 * balancës, kështu që nuk varet nga pozicioni i kolonave.
 */

export type TextItem = { x: number; y: number; s: string };
export type Line = { y: number; cells: { x: number; s: string }[]; text: string };

export type BankTx = {
  date: string;          // YYYY-MM-DD
  amount: number;        // gjithmonë pozitiv
  direction: "in" | "out";
  balance: number | null;
  description: string;
  reference: string | null;
};

export type Statement = {
  accountHolder: string | null;
  iban: string | null;
  openingBalance: number | null;
  closingBalance: number | null;
  transactions: BankTx[];
  /** true kur hapja + hyrjet − daljet = mbyllja (ekstrakti u lexua plotësisht) */
  balanced: boolean | null;
};

const DATE_RE = /^(\d{2})[/.](\d{2})[/.](\d{2}|\d{4})$/;
const AMOUNT_RE = /^-?\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})$|^-?\d+(?:[.,]\d{2})$/;

/** "15,000.00" | "15.000,00" | "15000.00" → 15000 */
export function parseAmount(s: string): number | null {
  const t = s.trim().replace(/\s/g, "");
  if (!AMOUNT_RE.test(t)) return null;
  const lastSep = Math.max(t.lastIndexOf("."), t.lastIndexOf(","));
  const int = t.slice(0, lastSep).replace(/[.,]/g, "");
  const n = Number(`${int}.${t.slice(lastSep + 1)}`);
  return Number.isFinite(n) ? n : null;
}

export function parseDate(s: string): string | null {
  const m = s.trim().match(DATE_RE);
  if (!m) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${m[2]}-${m[1]}`;
}

/** Grupon fragmentet e tekstit në rreshta (sipas y, nga lart poshtë) dhe heq dublikatat (tekst "bold"). */
export function itemsToLines(items: TextItem[], tolerance = 3): Line[] {
  const rows: { y: number; cells: { x: number; s: string }[] }[] = [];
  for (const it of items) {
    const s = it.s.trim();
    if (!s) continue;
    let row = rows.find((r) => Math.abs(r.y - it.y) <= tolerance);
    if (!row) rows.push((row = { y: it.y, cells: [] }));
    if (!row.cells.some((c) => c.s === s && Math.abs(c.x - it.x) < 2)) row.cells.push({ x: it.x, s });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) => {
      const cells = r.cells.sort((a, b) => a.x - b.x);
      return { y: r.y, cells, text: cells.map((c) => c.s).join(" ") };
    });
}

const isOpening = (t: string) => /balanca e fillimit|bilanci fillestar|opening balance|saldo iniziale/i.test(t);
const isClosing = (t: string) => /balanca ne fund|balanca në fund|bilanci p[eë]rfundimtar|closing balance|saldo finale/i.test(t);
const isHeader = (t: string) => /^(data e|transaksionit|pershkrimi|përshkrimi)\b/i.test(t) || /DEBI.*KREDI/i.test(t);
const isReference = (t: string) => /^referenca\b/i.test(t);
const isFiller = (t: string) => /^[.\s]*$/.test(t);

function lastAmount(line: Line): number | null {
  for (let i = line.cells.length - 1; i >= 0; i--) {
    const a = parseAmount(line.cells[i].s);
    if (a != null) return a;
  }
  return null;
}

/** Rreshti "ankër" i transaksionit: fillon me datë dhe ka të paktën një shumë. */
function anchor(line: Line): { date: string; amount: number; balance: number | null } | null {
  const date = parseDate(line.cells[0]?.s ?? "");
  if (!date) return null;
  const amounts = line.cells.map((c) => parseAmount(c.s)).filter((a): a is number => a != null);
  if (amounts.length === 0) return null;
  if (amounts.length === 1) return { date, amount: Math.abs(amounts[0]), balance: null };
  return { date, amount: Math.abs(amounts[amounts.length - 2]), balance: amounts[amounts.length - 1] };
}

export function parseStatement(lines: Line[]): Statement {
  const holderLine = lines.find((l) => /^klienti:/i.test(l.text));
  const iban = lines.map((l) => l.text.match(/\bAL\d{2}[0-9A-Z]{24}\b/)?.[0]).find(Boolean) ?? null;
  const st: Statement = {
    accountHolder: holderLine ? holderLine.cells.filter((c) => !/^klienti:/i.test(c.s) && !/^AL\d{2}/.test(c.s)).map((c) => c.s)[0] ?? null : null,
    iban,
    openingBalance: null,
    closingBalance: null,
    transactions: [],
    balanced: null,
  };

  let started = false;
  let block: { lines: string[]; a: ReturnType<typeof anchor>; ref: string | null } = { lines: [], a: null, ref: null };
  let prevBalance: number | null = null;

  const close = () => {
    if (block.a) {
      const a = block.a;
      let direction: "in" | "out" = "in";
      if (a.balance != null && prevBalance != null) direction = a.balance >= prevBalance ? "in" : "out";
      st.transactions.push({
        date: a.date,
        amount: a.amount,
        direction,
        balance: a.balance,
        description: block.lines.filter((t) => !isFiller(t)).join(" ").replace(/\s+/g, " ").trim(),
        reference: block.ref,
      });
      if (a.balance != null) prevBalance = a.balance;
    }
    block = { lines: [], a: null, ref: null };
  };

  for (const line of lines) {
    const t = line.text;
    if (isOpening(t)) {
      st.openingBalance = lastAmount(line);
      prevBalance = st.openingBalance;
      started = true;
      continue;
    }
    if (!started) {
      if (isHeader(t)) started = true;
      continue;
    }
    if (isClosing(t)) {
      close();
      st.closingBalance = lastAmount(line);
      break;
    }
    if (isHeader(t)) continue;
    const a = anchor(line);
    if (a) {
      if (block.a) close(); // bankë pa "Referenca": ankora e re mbyll bllokun e mëparshëm
      block.a = a;
      // teksti që mund të jetë në të njëjtin rresht me datën (përshkrim i shkurtër)
      const inline = line.cells.slice(1).filter((c) => parseAmount(c.s) == null && !parseDate(c.s)).map((c) => c.s).join(" ");
      if (inline) block.lines.push(inline);
      continue;
    }
    if (isReference(t)) {
      block.ref = t.replace(/^referenca\s*/i, "").trim() || null;
      close();
      continue;
    }
    block.lines.push(t);
  }
  if (block.a) close();

  if (st.openingBalance != null && st.closingBalance != null) {
    const net = st.transactions.reduce((s, x) => s + (x.direction === "in" ? x.amount : -x.amount), 0);
    st.balanced = Math.abs(st.openingBalance + net - st.closingBalance) < 0.01;
  }
  return st;
}
