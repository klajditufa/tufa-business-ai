import { sq, type Dictionary } from "./sq";

// Faza 1: vetëm shqip aktiv; en.ts shtohet kur të jenë fiksuar tekstet.
export const dictionaries: Record<"sq" | "en", Dictionary> = { sq, en: sq };

export function t(locale: "sq" | "en" = "sq") {
  return dictionaries[locale];
}

/** Zëvendëson {name} me vlerat e dhëna. */
export function fmt(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
