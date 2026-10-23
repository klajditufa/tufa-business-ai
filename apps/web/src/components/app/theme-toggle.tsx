"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/** Tema: sistemi / e çelët / e errët. Ruhet në localStorage("tufa-theme"); skripti në <head> e vendos para pikturimit. */
type Theme = "auto" | "light" | "dark";
const KEY = "tufa-theme";
const listeners = new Set<() => void>();

function read(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "auto";
  } catch {
    return "auto";
  }
}

function write(t: Theme) {
  try {
    if (t === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    /* shfletim privat: tema vlen vetëm për këtë faqe */
  }
  if (t === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  listeners.forEach((l) => l());
}

export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "auto" as Theme,
  );
  const options: [Theme, typeof Sun, string][] = [
    ["auto", Monitor, "Sipas sistemit"],
    ["light", Sun, "E çelët"],
    ["dark", Moon, "E errët"],
  ];
  return (
    <div className={cn("inline-flex rounded-lg bg-muted p-1", className)} role="radiogroup" aria-label="Tema">
      {options.map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          title={label}
          onClick={() => write(value)}
          className={cn("rounded-md px-2 py-1 text-muted-foreground", theme === value && "bg-card text-foreground shadow-sm")}
        >
          <Icon className="h-4 w-4" />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
