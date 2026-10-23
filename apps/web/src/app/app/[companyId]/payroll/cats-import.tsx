"use client";

import { MonthPickerInput } from "@mantine/dates";
import { IconCalendar } from "@tabler/icons-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconFileUpload as FileUp, IconShieldCheck as ShieldCheck, IconUpload as Upload } from "@tabler/icons-react";
import { detectKind, findPeriodInGrid, parseCsv, parseLines, parseSummary, type Grid, type LineRow, type SummaryRow } from "@/lib/cats-payroll";
import { importPayrollLinesAction, importPayrollSummaryAction } from "@/server/actions/payroll";
import { Alert, Button, Card } from "@/components/ui";
import { money } from "@/lib/format";
import { monthLabelSq } from "@/components/app/month-picker";

/** Skedari → tabelë qelizash. xlsx (read-excel-file), "xls" HTML (DOMParser) ose CSV/TSV. Asgjë nuk dërgohet në server. */
async function fileToGrid(file: File): Promise<Grid> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    const { default: readXlsxFile } = await import("read-excel-file");
    const rows = await readXlsxFile(file);
    return rows.map((r) => r.map((c) => (c == null ? "" : c instanceof Date ? c.toLocaleDateString("sq-AL") : String(c))));
  }
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) {
    throw new Error("Ky është formati i vjetër .xls (Excel 97). Hape në Excel ose LibreOffice dhe ruaje si .xlsx, pastaj ngarkoje sërish.");
  }
  let text = new TextDecoder("utf-8").decode(buf);
  if (text.includes("�")) text = new TextDecoder("windows-1250").decode(buf);
  if (/<table/i.test(text)) {
    const doc = new DOMParser().parseFromString(text, "text/html");
    const grid: Grid = [];
    doc.querySelectorAll("tr").forEach((tr) => grid.push([...tr.querySelectorAll("th,td")].map((c) => (c.textContent ?? "").replace(/\s+/g, " ").trim())));
    return grid;
  }
  return parseCsv(text);
}

type Parsed =
  | { kind: "summary"; rows: SummaryRow[] }
  | { kind: "lines"; rows: LineRow[]; year: number; month: number };

export function CatsImport({ companyId, canWrite }: { companyId: string; canWrite: boolean }) {
  const router = useRouter();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "danger" | "warning"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const now = new Date();

  const onFile = async (file?: File) => {
    if (!file) return;
    setMsg(null); setParsed(null); setFileName(file.name);
    try {
      const grid = await fileToGrid(file);
      const kind = detectKind(grid);
      if (kind === "summary") {
        const rows = parseSummary(grid);
        if (!rows.length) throw new Error("U njoh si listë listëpagesash, por nuk u gjet asnjë muaj.");
        setParsed({ kind, rows });
      } else if (kind === "lines") {
        const rows = parseLines(grid);
        if (!rows.length) throw new Error("U njoh si detaje E-SIG 025, por nuk u gjet asnjë punonjës me numër personal.");
        const p = findPeriodInGrid(grid) ?? { year: now.getFullYear(), month: now.getMonth() === 0 ? 12 : now.getMonth() };
        setParsed({ kind, rows, ...p });
        if (!findPeriodInGrid(grid)) setMsg({ tone: "warning", text: "Muaji nuk u gjet në skedar — kontrolloje më poshtë para importit." });
      } else {
        throw new Error("Skedari nuk duket si eksport nga e-Filing (Listëpagesa të Dorëzuara ose Shfaq Detajet).");
      }
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    }
  };

  const doImport = () =>
    start(async () => {
      if (!parsed) return;
      const res = parsed.kind === "summary"
        ? await importPayrollSummaryAction(companyId, parsed.rows)
        : await importPayrollLinesAction(companyId, parsed.year, parsed.month, parsed.rows);
      setMsg(res.ok ? { tone: "success", text: res.message ?? "U importua." } : { tone: "danger", text: res.error ?? "Gabim" });
      if (res.ok) { setParsed(null); setFileName(null); router.refresh(); }
    });

  if (!canWrite) return null;
  const totals = parsed?.kind === "summary"
    ? parsed.rows.reduce((a, r) => ({ social: a.social + r.social, health: a.health + r.health, tax: a.tax + r.income_tax }), { social: 0, health: 0, tax: 0 })
    : null;

  return (
    <Card className="no-print space-y-3">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-6 text-center text-sm hover:bg-muted/40">
        <FileUp className="h-6 w-6 text-muted-foreground" />
        <span className="font-medium">{fileName ?? "Ngarko eksportin Excel nga C@TS"}</span>
        <span className="text-xs text-muted-foreground">e-Filing → Listëpagesat → Listëpagesa të Dorëzuara (ose Shfaq Detajet) → Eksporto në Excel</span>
        <input type="file" accept=".xls,.xlsx,.htm,.html,.csv,.txt" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        Skedari lexohet në këtë browser; në platformë ruhen vetëm vlerat e listëpagesës pasi klikon “Importo”.
      </p>

      {parsed?.kind === "summary" && totals && (
        <div className="space-y-2 text-sm">
          <div className="font-medium">
            {parsed.rows.length} muaj · {monthLabelSq(parsed.rows.at(-1)!.year, parsed.rows.at(-1)!.month)} – {monthLabelSq(parsed.rows[0].year, parsed.rows[0].month)}
          </div>
          <div className="text-muted-foreground">
            Gjithsej: sig. shoqërore {money(totals.social, "ALL", 0)} · sig. shëndetësore {money(totals.health, "ALL", 0)} · TAP {money(totals.tax, "ALL", 0)}
          </div>
        </div>
      )}
      {parsed?.kind === "lines" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{parsed.rows.length} punonjës (E-SIG 025) për muajin</span>
          <MonthPickerInput
            size="xs"
            w={130}
            valueFormat="MM/YYYY"
            leftSection={<IconCalendar size={14} stroke={1.8} />}
            value={`${parsed.year}-${String(parsed.month).padStart(2, "0")}-01`}
            onChange={(v) => { if (!v) return; const [y, m] = v.split("-").map(Number); setParsed({ ...parsed, year: y, month: m }); }}
            aria-label="Muaji i listëpagesës"
          />
          <span className="text-muted-foreground">· bruto {money(parsed.rows.reduce((a, r) => a + r.gross, 0), "ALL", 0)}</span>
        </div>
      )}
      {parsed && (
        <Button type="button" size="sm" disabled={pending} onClick={doImport}>
          <Upload className="h-4 w-4" /> {pending ? "Duke importuar…" : "Importo"}
        </Button>
      )}
      {msg && <Alert tone={msg.tone === "warning" ? "warning" : msg.tone}>{msg.text}</Alert>}
    </Card>
  );
}
