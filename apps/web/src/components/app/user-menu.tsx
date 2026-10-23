"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Building2, LifeBuoy, LogOut, Scale, Settings, SlidersHorizontal } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

/** Menuja e përdoruesit: tema (në telefon), cilësimet, paneli i studios, dalja. */
export function UserMenu({
  userName,
  role,
  settingsHref,
  studio,
  superAdmin,
  logout,
}: {
  userName: string;
  role: string | null;
  settingsHref?: string;
  studio: boolean;
  superAdmin: boolean;
  logout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const initials = userName.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
  const item = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted";

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-2 text-sm hover:bg-muted"
      >
        <SlidersHorizontal className="h-4 w-4 sm:hidden" />
        <span className="hidden h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent sm:flex">{initials}</span>
        <span className="sr-only">Menuja</span>
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-border bg-card p-2 shadow-xl" role="menu">
          <div className="px-3 py-2">
            <div className="truncate text-sm font-semibold">{userName}</div>
            {role && <div className="text-xs text-muted-foreground">Roli: {role}</div>}
          </div>
          <div className="px-3 pb-2 sm:hidden">
            <ThemeToggle />
          </div>
          <div className="my-1 border-t border-border" />
          {settingsHref && (
            <Link href={settingsHref} className={item} onClick={() => setOpen(false)}>
              <Settings className="h-4 w-4" /> Cilësimet e subjektit
            </Link>
          )}
          {studio && (
            <Link href="/studio" className={item} onClick={() => setOpen(false)}>
              <Building2 className="h-4 w-4" /> Paneli i studios
            </Link>
          )}
          {superAdmin && (
            <Link href="/admin/tax-rules" className={item} onClick={() => setOpen(false)}>
              <Scale className="h-4 w-4" /> Rregullat tatimore
            </Link>
          )}
          {settingsHref && (
            <Link href={`${settingsHref}#help`} className={item} onClick={() => setOpen(false)}>
              <LifeBuoy className="h-4 w-4" /> Ndihmë
            </Link>
          )}
          <div className="my-1 border-t border-border" />
          <form action={logout}>
            <button type="submit" className={`${item} w-full text-danger`}>
              <LogOut className="h-4 w-4" /> Dil
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
