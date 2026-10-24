// A list as an A4 document: title, business and period, then one table with a totals row.
import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { Translate } from "../i18n";
import { documentBase, listLayout, SHADE } from "./common";

export interface ReportColumn<T> {
  label: string;
  value: (row: T) => string | undefined;
  right?: boolean;
  width?: number | "*" | "auto";
}

export interface Report<T> {
  title: string;
  subtitle: string;
  details: string[];
  columns: ReportColumn<T>[];
  rows: T[];
  totals?: string[];
}

export function reportDocument<T>(report: Report<T>, t: Translate): TDocumentDefinitions {
  const { columns } = report;
  const cell = (text: string | undefined, column: ReportColumn<T>, extra: object = {}): TableCell => ({
    text: text ?? "",
    ...(column.right ? { alignment: "right" } : {}),
    ...extra,
  });
  const body: TableCell[][] = [
    columns.map((column) => cell(column.label, column, { style: "th" })),
    ...report.rows.map((row) => columns.map((column) => cell(column.value(row), column))),
  ];
  if (!report.rows.length)
    body.push(columns.map((column, index) => cell(index ? "" : t("pdf.empty"), column, { style: "muted" })));
  if (report.totals)
    body.push(
      columns.map((column, index) => cell(report.totals?.[index], column, { bold: true, fillColor: SHADE })),
    );
  const content: Content[] = [
    {
      columns: [
        {
          stack: [
            { text: report.title, style: "title", fontSize: 16, characterSpacing: 0 },
            { text: report.subtitle, margin: [0, 3, 0, 0] },
          ],
        },
        {
          width: "auto",
          stack: report.details.map((text) => ({ text, style: "muted", alignment: "right" })),
        },
      ],
      margin: [0, 0, 0, 14],
    },
    {
      table: { headerRows: 1, widths: columns.map((column) => column.width ?? "auto"), body },
      layout: listLayout,
      fontSize: 8,
    },
  ];
  return documentBase(report.title, t("pdf.reportNote"), content, t);
}
