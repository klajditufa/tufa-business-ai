import { zipSync } from "fflate";

/** Hands a file to the browser's download. */
export function download(filename: string, content: Blob | string, type = "text/plain"): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 30_000);
}

/** A safe file name from parts: "Faturë", "12/2026" → "Faturë_12_2026". */
export const fileName = (...parts: (string | undefined)[]): string =>
  parts
    .filter(Boolean)
    .join("_")
    .replace(/[^\p{L}\p{N}.-]+/gu, "_");

function csvCell(value: unknown): string {
  let text =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : value === undefined || value === null
          ? ""
          : JSON.stringify(value);
  // Keep spreadsheet apps from evaluating text that looks like a formula.
  if (/^[=+\-@\t\r]/.test(text) && !Number.isFinite(Number(text))) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const BOM = "\uFEFF";

/** CSV with a BOM so Excel reads the UTF-8 text (names often contain ë and ç). */
export function toCsv<C extends string>(rows: Partial<Record<C, unknown>>[], columns: readonly C[]): Blob {
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ];
  return new Blob([`${BOM}${lines.join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" });
}

/** A ZIP of the given files, stored without compression (PDFs are compressed already). */
export function zip(files: { name: string; bytes: Uint8Array }[]): Blob {
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const file of files) {
    let name = file.name;
    for (let n = 2; name in entries; n++) name = file.name.replace(/(\.\w+)?$/, `_${n}$1`);
    entries[name] = [file.bytes, { level: 0 }];
  }
  return new Blob([zipSync(entries)], { type: "application/zip" });
}

export function base64ToBytes(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
