"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Company } from "@/server/services/companies";

const label = (c: Company) => c.trade_name || c.legal_name;

/**
 * Zgjedhësi i subjektit në formë "pill" (si cis-client-2): emri, NIPT-i dhe statusi i TVSH-së.
 * Ndërrimi ruan modulin e hapur (/app/<id>/vat → /app/<tjetri>/vat).
 */
export function CompanySwitcher({ current, companies }: { current?: Company; companies: Company[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
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

  const go = (c: Company) => {
    setOpen(false);
    if (current && c.id === current.id) return;
    router.push(current && pathname.startsWith(`/app/${current.id}`) ? pathname.replace(`/app/${current.id}`, `/app/${c.id}`) : `/app/${c.id}/dashboard`);
  };
  const needle = q.trim().toLowerCase();
  const list = needle ? companies.filter((c) => `${label(c)} ${c.nipt}`.toLowerCase().includes(needle)) : companies;

  return (
    <div ref={box} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 max-w-full items-center gap-2 rounded-full border border-border bg-card px-3 text-sm hover:bg-muted sm:px-4"
      >
        {current ? (
          <>
            <span className={cn("h-2 w-2 shrink-0 rounded-full", current.vat_registered ? "bg-success" : "bg-warning")} aria-hidden />
            <span className="hidden shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent sm:inline">{current.vat_registered ? "TVSH" : "PA TVSH"}</span>
            <span className="truncate font-semibold">{label(current)}</span>
            <span className="hidden font-mono text-xs text-muted-foreground md:inline">{current.nipt}</span>
          </>
        ) : (
          <span className="font-semibold">Zgjidh subjektin</span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(92vw,380px)] rounded-xl border border-border bg-card p-2 shadow-xl sm:left-auto" role="listbox">
          {companies.length > 6 && (
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Kërko emër ose NIPT"
                className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
          )}
          <div className="max-h-80 overflow-y-auto">
            {list.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={c.id === current?.id}
                onClick={() => go(c)}
                className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted", c.id === current?.id && "bg-accent/10")}
              >
                <span className={cn("h-2 w-2 shrink-0 rounded-full", c.vat_registered ? "bg-success" : "bg-warning")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{label(c)}</span>
                  <span className="font-mono text-xs text-muted-foreground">{c.nipt}</span>
                </span>
                {c.id === current?.id && <Check className="h-4 w-4 text-accent" />}
              </button>
            ))}
            {list.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Asnjë subjekt.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
