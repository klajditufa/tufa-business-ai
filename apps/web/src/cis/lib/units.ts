// Measure units arrive as free text ("kg", "KG", "Kg.", "kilogram"; "Copë", "cope", "pcs").
// The shared list (cis_client/units.json, also used by the Python side) maps them to one code and label.
import list from "./units.json";
import type { Lang } from "../i18n";

interface UnitEntry {
  code: string;
  sq: string;
  en: string;
  aliases: string[];
}

export interface Unit {
  code: string; // "KGM"; empty when the text is not a known unit
  label: string; // "kg"; the text as written when it is not known
  key: string; // grouping key: the code, or the folded text
}

const stripAccents = (text: string) => text.normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** Lower case, without accents (ë → e, ç → c), spaces, dots and superscripts. */
export const fold = (text: string): string =>
  stripAccents(text.replace(/²/g, "2").replace(/³/g, "3"))
    .toLowerCase()
    .replace(/[\s.]+/g, "");

const aliases = new Map<string, UnitEntry>();
for (const entry of list as UnitEntry[]) {
  for (const alias of [entry.code, entry.sq, entry.en, ...entry.aliases]) {
    if (!aliases.has(fold(alias))) aliases.set(fold(alias), entry);
  }
}

export function unitOf(text: string | undefined, lang: Lang): Unit {
  const original = (text || "").trim();
  const entry = aliases.get(fold(original));
  return entry
    ? { code: entry.code, label: entry[lang], key: entry.code }
    : { code: "", label: original, key: fold(original) };
}

/** Item names compared without case, accents or extra spaces ("Naftë  Dizel" = "nafte dizel"). */
export const nameKey = (text: string | undefined): string =>
  stripAccents(text || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
