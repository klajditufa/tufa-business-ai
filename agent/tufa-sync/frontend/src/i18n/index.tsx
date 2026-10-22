import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { usePreference } from "../lib/preferences";
import { en, sq, type StringKey } from "./strings";

export type Lang = "sq" | "en";
export type Vars = Record<string, string | number>;
export type Translate = (key: StringKey, vars?: Vars) => string;

const STRINGS: Record<Lang, Record<StringKey, string>> = { sq, en };

export function translate(lang: Lang, key: StringKey, vars?: Vars): string {
  const text = STRINGS[lang][key];
  return vars ? text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? "")) : text;
}

/** A key built at run time (e.g. `pay.${type}`), or undefined when no such text exists. */
export function maybeKey(key: string): StringKey | undefined {
  return key in en ? (key as StringKey) : undefined;
}

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translate;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = usePreference("lang");
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo<I18n>(
    () => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }),
    [lang, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n needs I18nProvider");
  return context;
}
