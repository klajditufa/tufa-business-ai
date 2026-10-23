"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarCheck, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export function StudioTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/studio/overview", label: "Të gjitha subjektet", icon: LayoutGrid, active: pathname.startsWith("/studio/overview") },
    { href: "/studio", label: "Deklarimet", icon: CalendarCheck, active: pathname === "/studio" },
    { href: "/studio/companies", label: "Subjektet", icon: Building2, active: pathname.startsWith("/studio/companies") },
  ];
  return (
    <nav className="app-tabs -mx-4 flex overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0" aria-label="Paneli i studios">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm sm:px-4",
            t.active ? "border-primary font-medium" : "border-transparent text-foreground/80 hover:bg-muted/60",
          )}
        >
          <t.icon className="h-4 w-4" />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
