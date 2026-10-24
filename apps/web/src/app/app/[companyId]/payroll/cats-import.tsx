"use client";

import { MonthPickerInput } from "@mantine/dates";
import { IconCalendar } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconFileUpload as FileUp, IconShieldCheck as ShieldCheck, IconUpload as Upload } from "@tabler/icons-react";
import { detectKind, findPeriodInGrid, mergeTables, parseCsv, parseLines, parseSummary, type Grid, type LineRow, type SummaryRow } from "@/lib/cats-payroll";
import { importPayrollLinesAction, importPayrollSummaryAction } from "@/server/actions/payroll";
import { Alert, Button, Card } from "@/components/ui";
import { money } from "@/lib/format";
import { monthLabelSq } from "@/components/app/month-picker";
import Link from "next/link";
import { Button as MantineButton, Group, Text } from "@mantine/core";
import { IconFileDescription } from "@tabler/icons-react";
import { takeHandOff } from "@/lib/filing/handoff";

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

type Snapshot = { url: string; title: string; nipt: string; tables: string[][][]; capturedAt: number };

/**
 * Importi i listëpagesës nga C@TS: me skedarin e eksportit, ose direkt nga shtesa "TUFA · e-Filing"
 * (faqja e hapur nga përdoruesi pas hyrjes me e-Albania; kapja merret një herë, me id).
 */
export function CatsImport({ companyId, canWrite, companyNipt, captureId }: { companyId: string; canWrite: boolean; companyNipt?: string; captureId?: string }) {
  const router = useRouter();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "danger" | "warning"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const onGrid = useCallback((grid: Grid) => {
    const now = new Date();
    try {
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
        throw new Error("Kjo nuk duket si Listëpagesa të Dorëzuara ose Shfaq Detajet nga e-Filing.");
      }
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    }
  }, []);

  const onFile = async (file?: File) => {
    if (!file) return;
    setMsg(null); setParsed(null); setFileName(file.name);
    try {
      onGrid(await fileToGrid(file));
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    }
  };

  /** Faqja e portalit (nga shtesa): kontrollohen adresa dhe NIPT-i, pastaj lexohen tabelat. */
  const acceptSnapshot = useCallback(
    (snap: Snapshot) => {
      setMsg(null);
      setParsed(null);
      if (!snap.url.startsWith("https://efiling.tatime.gov.al/cats_public/")) {
        setMsg({ tone: "danger", text: "Faqja nuk vjen nga e-Filing." });
        return;
      }
      if (companyNipt && snap.nipt.toUpperCase() !== companyNipt.toUpperCase()) {
        setMsg({ tone: "danger", text: `Faqja është e subjektit ${snap.nipt}, jo e ${companyNipt}.` });
        return;
      }
      setFileName(`e-Filing · ${snap.title || "faqja e hapur"}`);
      onGrid(mergeTables(snap.tables));
    },
    [companyNipt, onGrid],
  );

  // Faqja e sjellë nga skeda e-Filing ("Importo te Listëpagesa").
  useEffect(() => {
    if (!canWrite) return;
    const timer = setTimeout(() => {
      const snap = takeHandOff(companyId);
      if (snap) acceptSnapshot(snap);
    }, 0);
    return () => clearTimeout(timer);
  }, [companyId, canWrite, acceptSnapshot]);

  // Kapja nga shtesa e Chrome: kërkohet një herë sipas id-së dhe kontrollohet NIPT-i dhe adresa.
  const requested = useRef(false);
  useEffect(() => {
    if (!captureId || !canWrite || requested.current) return;
    requested.current = true;
    const timer = setTimeout(() => setMsg({ tone: "warning", text: "Shtesa “TUFA · e-Filing” nuk u përgjigj. Kontrollo që është e instaluar dhe dërgoje faqen sërish." }), 4000);
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { source?: string; type?: string; id?: string; result?: { ok: boolean; code?: string; snapshot?: Snapshot } };
      if (event.source !== window || event.origin !== window.location.origin || data?.source !== "tufa-extension" || data.type !== "cats-capture" || data.id !== captureId) return;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      const snap = data.result?.snapshot;
      if (!data.result?.ok || !snap) {
        setMsg({ tone: "danger", text: "Faqja nga e-Filing ka skaduar ose është marrë tashmë (vlen 15 minuta). Dërgoje sërish nga shtesa." });
        return;
      }
      acceptSnapshot(snap);
      // Hiq id-në nga adresa që rifreskimi të mos e kërkojë sërish.
      window.history.replaceState(null, "", window.location.pathname);
    };
    window.addEventListener("message", onMessage);
    window.postMessage({ source: "tufa-app", type: "cats-request", id: captureId }, window.location.origin);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
  }, [captureId, canWrite, acceptSnapshot]);

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
      <Group justify="space-between" gap="sm" className="rounded-lg border border-border px-4 py-3">
        <Text size="sm">
          Direkt nga C@TS: te skeda <b>e-Filing</b> hyni me e-Albania, hapni Listëpagesa të Dorëzuara (ose Shfaq Detajet) dhe shtypni
          “Importo te Listëpagesa”.
        </Text>
        <MantineButton component={Link} href={`/app/${companyId}/filing`} size="xs" variant="light" leftSection={<IconFileDescription size={14} />}>
          Hap e-Filing
        </MantineButton>
      </Group>
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
