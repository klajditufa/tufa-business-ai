// UI preferences, kept together under one localStorage key and shared by every component that
// reads them (a change in one place re-renders the others). Values are checked when read, so
// an old or hand-edited entry can never break the app.
import { useCallback, useSyncExternalStore } from "react";
import type { Sort } from "../types";
import { PRESETS, type Preset } from "./format";
import { MODULES } from "../features/accounting/modules";
import { storage } from "./storage";

export interface Preferences {
  lang: "sq" | "en";
  theme: "auto" | "light" | "dark";
  tab: string;
  pageSize: number;
  mode: "invoices" | "items";
  preset: Preset;
  overviewPreset: Preset;
  accountingModule: string;
  invoiceSort: Sort;
  itemSort: Sort;
}

export const PREFERENCES_KEY = "tufa.cis.preferences"; // public/theme-init.js reads "theme" from it
export const PAGE_SIZES = [25, 50, 100, 250];

const DEFAULTS: Preferences = {
  lang: "sq", // Albanian unless the user switched
  theme: "auto",
  tab: "sales",
  pageSize: 100,
  mode: "invoices",
  preset: "thisMonth",
  overviewPreset: "lastMonth",
  accountingModule: "",
  invoiceSort: { key: "date", dir: -1 },
  itemSort: { key: "total", dir: -1 },
};

const oneOf = <T>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;
const sort = (value: unknown, fallback: Sort): Sort => {
  const candidate = value as Partial<Sort> | null;
  return typeof candidate?.key === "string" && (candidate.dir === 1 || candidate.dir === -1)
    ? { key: candidate.key, dir: candidate.dir }
    : fallback;
};

// The first version kept some preferences under keys of their own; they are folded in once and removed.
const LEGACY_KEYS = { lang: "cis-client.lang", tab: "cis-client.tab", theme: "cis-client.theme" } as const;

function read(): Preferences {
  let saved: Partial<Record<keyof Preferences, unknown>> = {};
  try {
    const parsed: unknown = JSON.parse(storage.get(PREFERENCES_KEY) || "{}");
    if (parsed && typeof parsed === "object") saved = parsed;
  } catch {
    // Unreadable entry: start from the defaults.
  }
  for (const [preference, key] of Object.entries(LEGACY_KEYS) as [keyof typeof LEGACY_KEYS, string][]) {
    const legacy = storage.get(key);
    if (legacy === null) continue;
    saved[preference] ??= legacy;
    storage.remove(key);
  }
  return {
    lang: oneOf(saved.lang, ["sq", "en"] as const, DEFAULTS.lang),
    theme: oneOf(saved.theme, ["auto", "light", "dark"] as const, DEFAULTS.theme),
    tab: typeof saved.tab === "string" ? saved.tab : DEFAULTS.tab,
    pageSize: oneOf(saved.pageSize, PAGE_SIZES, DEFAULTS.pageSize),
    mode: oneOf(saved.mode, ["invoices", "items"] as const, DEFAULTS.mode),
    preset: oneOf(saved.preset, PRESETS, DEFAULTS.preset),
    overviewPreset: oneOf(saved.overviewPreset, PRESETS, DEFAULTS.overviewPreset),
    accountingModule: oneOf(
      saved.accountingModule,
      ["", ...MODULES.map((module) => module.id)],
      DEFAULTS.accountingModule,
    ),
    invoiceSort: sort(saved.invoiceSort, DEFAULTS.invoiceSort),
    itemSort: sort(saved.itemSort, DEFAULTS.itemSort),
  };
}

let current = read();
storage.set(PREFERENCES_KEY, JSON.stringify(current)); // also writes back what was migrated
const listeners = new Set<() => void>();

/** Calls `listener` after any preference changes; returns the unsubscribe function. */
export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPreference<K extends keyof Preferences>(key: K): Preferences[K] {
  return current[key];
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  if (JSON.stringify(current[key]) === JSON.stringify(value)) return; // unchanged: nothing to save or tell
  current = { ...current, [key]: value };
  storage.set(PREFERENCES_KEY, JSON.stringify(current));
  listeners.forEach((listener) => {
    listener();
  });
}

/** One preference and its setter, like useState but saved and shared. */
export function usePreference<K extends keyof Preferences>(
  key: K,
): [Preferences[K], (value: Preferences[K]) => void] {
  const value = useSyncExternalStore(subscribePreferences, () => current[key]);
  const set = useCallback(
    (next: Preferences[K]) => {
      setPreference(key, next);
    },
    [key],
  );
  return [value, set];
}
