"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileInput, FileOutput, Percent, Landmark, FolderArchive, BarChart3, Settings, LifeBuoy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

export function Sidebar({ companyId, role }: { companyId: string; role: string | null }) {
  const pathname = usePathname();
  const d = t();
  const base = `/app/${companyId}`;
  const items = [
    { href: `${base}/dashboard`, label: d.nav.dashboard, icon: LayoutDashboard },
    { href: `${base}/invoices?direction=sale`, label: d.nav.sales, icon: FileOutput, match: "/invoices" },
    { href: `${base}/invoices?direction=purchase`, label: d.nav.purchases, icon: FileInput, match: "__never" },
    { href: `${base}/vat`, label: d.nav.vat, icon: Percent },
    { href: `${base}/declarations`, label: d.nav.declarations, icon: Landmark },
    { href: `${base}/documents`, label: d.nav.documents, icon: FolderArchive },
    { href: `${base}/reports`, label: d.nav.reports, icon: BarChart3 },
    { href: `${base}/settings`, label: d.nav.settings, icon: Settings },
  ];
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="px-5 py-5 text-lg font-semibold tracking-tight text-white">{d.app.name}</div>
        <nav className="flex-1 space-y-0.5 px-3">
          {items.map((it) => {
            const active = pathname.startsWith(it.match ?? it.href.split("?")[0]);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-sidebar-active/70",
                  active && it.match !== "__never" && "bg-sidebar-active text-white",
                )}
              >
                <it.icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-3 py-3">
          <Link href={`${base}/settings#help`} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-active/70">
            <LifeBuoy className="h-4 w-4" /> {d.nav.help}
          </Link>
          {role && <p className="px-3 pt-2 text-xs text-sidebar-foreground/60">Roli: {role}</p>}
        </div>
      </aside>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-card lg:hidden">
        {items.slice(0, 5).map((it) => {
          const active = pathname.startsWith(it.match ?? it.href.split("?")[0]);
          return (
            <Link key={it.href} href={it.href} className={cn("flex flex-col items-center gap-1 py-2 text-[10px]", active && it.match !== "__never" ? "text-accent" : "text-muted-foreground")}>
              <it.icon className="h-5 w-5" />
              {it.label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
