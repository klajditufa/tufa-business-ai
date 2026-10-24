import type { Content, CustomTableLayout, TDocumentDefinitions } from "pdfmake/interfaces";
import type { Translate } from "../i18n";

export const INK = "#1c1b19";
export const MUTED = "#6b6862";
export const LINE = "#cfcbc3";
export const SHADE = "#f2f1ed";

const padding = {
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 3.5,
  paddingBottom: () => 3.5,
};

/** Every cell framed: item tables. */
export const gridLayout: CustomTableLayout = {
  ...padding,
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => LINE,
  vLineColor: () => LINE,
};

/** A framed box with hairlines between rows: parties, details, totals. */
export const boxLayout: CustomTableLayout = {
  ...padding,
  hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0.8 : 0.3),
  vLineWidth: (i, node) => (i === 0 || i === (node.table.widths?.length ?? 0) ? 0.8 : 0),
  hLineColor: () => LINE,
  vLineColor: () => LINE,
};

/** Horizontal hairlines only: lists in reports. */
export const listLayout: CustomTableLayout = {
  ...padding,
  hLineWidth: (i, node) =>
    i === 0 || i === node.table.body.length ? 0 : i === 1 || i === node.table.body.length - 1 ? 0.8 : 0.3,
  vLineWidth: () => 0,
  hLineColor: () => LINE,
};

export const heading = (text: string, margin: [number, number, number, number] = [0, 0, 0, 4]): Content => ({
  text: text.toUpperCase(),
  style: "heading",
  margin,
});

export function documentBase(
  title: string,
  note: string,
  content: Content[],
  t: Translate,
): TDocumentDefinitions {
  return {
    pageSize: "A4",
    pageMargins: [34, 34, 34, 46],
    info: { title },
    defaultStyle: { font: "Roboto", fontSize: 8.5, lineHeight: 1.15, color: INK },
    styles: {
      title: { fontSize: 20, bold: true, characterSpacing: 1.5 },
      heading: { fontSize: 7.5, bold: true, color: MUTED, characterSpacing: 0.6 },
      muted: { color: MUTED },
      small: { fontSize: 7 },
      th: { bold: true, fontSize: 7.5, fillColor: SHADE },
      right: { alignment: "right" },
    },
    footer: (page, pages) => ({
      margin: [34, 16, 34, 0],
      columns: [
        { text: note, style: ["muted", "small"] },
        {
          text: t("pdf.page", { page, pages }),
          style: ["muted", "small"],
          alignment: "right",
          width: "auto",
        },
      ],
    }),
    content,
  };
}
