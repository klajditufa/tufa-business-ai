import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { Translate } from "../../i18n";
import { toCsv } from "../../lib/files";
import { documentBase, listLayout } from "../../pdf/common";
import type { PortalSnapshot } from "./types";

const columnCount = (rows: string[][]): number => Math.max(1, ...rows.map((row) => row.length));

/** Preserve every row, including any portal header rows. Do not infer payroll semantics. */
export function portalTableCsv(rows: string[][], t: Translate): Blob {
  const columns = Array.from({ length: columnCount(rows) }, (_, index) =>
    t("filing.column", { n: index + 1 }),
  );
  return toCsv(
    rows.map((row) => Object.fromEntries(columns.map((key, index) => [key, row[index] ?? ""]))),
    columns,
  );
}

/** Wide payroll tables are split into groups of six columns with stable row numbers. */
export function portalTableDocument(
  snapshot: PortalSnapshot,
  table: number,
  t: Translate,
): TDocumentDefinitions {
  const rows = snapshot.tables[table] ?? [];
  const count = columnCount(rows);
  const content: Content[] = [
    { text: t("filing.report"), style: "title" },
    { text: `${snapshot.title} · ${snapshot.nipt}`, margin: [0, 6, 0, 4] },
    { text: snapshot.url, style: "muted", fontSize: 7 },
    {
      text: t("filing.captured", { time: new Date(snapshot.capturedAt * 1000).toISOString() }),
      style: "muted",
      margin: [0, 4, 0, 14],
    },
  ];
  for (let start = 0; start < count; start += 6) {
    const indexes = Array.from({ length: Math.min(6, count - start) }, (_, index) => start + index);
    content.push(
      {
        text: `${t("filing.table", { n: table + 1 })} · ${start + 1}–${start + indexes.length}`,
        style: "heading",
        pageBreak: start ? "before" : undefined,
        margin: [0, 0, 0, 8],
      },
      {
        table: {
          headerRows: 1,
          widths: [24, ...indexes.map(() => "*" as const)],
          body: [
            [
              { text: "#", style: "th" },
              ...indexes.map((index) => ({ text: t("filing.column", { n: index + 1 }), style: "th" })),
            ],
            ...rows.map((row, index) => [String(index + 1), ...indexes.map((column) => row[column] ?? "")]),
          ],
        },
        layout: listLayout,
      },
    );
  }
  return {
    ...documentBase(t("filing.report"), t("filing.reportNote"), content, t),
    pageOrientation: "landscape",
  };
}
