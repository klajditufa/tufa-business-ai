"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArrowDownLeft, ArrowUpRight, Calculator, FolderArchive, Landmark, LayoutDashboard, LayoutGrid, Percent, Settings, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Skedat e subjektit (si cis-client-2): vijë e hollë poshtë listës, vijë 2px nën skedën e hapur, rrëshqasin në telefon. */
export function CompanyTabs({ companyId, studioCount }: { companyId: string; studioCount: number | null }) {
  const pathname = usePathname();
  const direction = useSearchParams().get("direction");
  const base = `/app/${companyId}`;
  const isInvoices = pathname.startsWith(`${base}/invoices`) && !pathname.startsWith(`${base}/invoices/bank`);
  const tabs = [
    { href: `${base}/dashboard`, label: "Paneli", icon: LayoutDashboard, active: pathname.startsWith(`${base}/dashboard`) },
    { href: `${base}/invoices?direction=sale`, label: "Shitjet", icon: ArrowUpRight, active: isInvoices && direction !== "purchase" },
    { href: `${base}/invoices?direction=purchase`, label: "Blerjet", icon: ArrowDownLeft, active: isInvoices && direction === "purchase" },
    { href: `${base}/vat`, label: "TVSH", icon: Percent, active: pathname.startsWith(`${base}/vat`) },
    { href: `${base}/payroll`, label: "Listëpagesa", icon: Wallet, active: pathname.startsWith(`${base}/payroll`) },
    { href: `${base}/declarations`, label: "Deklarimet", icon: Landmark, active: pathname.startsWith(`${base}/declarations`) },
    {
      href: `${base}/tools`,
      label: "Raporte & mjete",
      icon: Calculator,
      active: ["/tools", "/reports", "/parties", "/invoices/bank"].some((p) => pathname.startsWith(base + p)),
    },
    { href: `${base}/documents`, label: "Dokumentet", icon: FolderArchive, active: pathname.startsWith(`${base}/documents`) },
    { href: `${base}/settings`, label: "Cilësimet", icon: Settings, active: pathname.startsWith(`${base}/settings`) },
  ];
  const cls = (active: boolean) =>
    cn(
      "-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition sm:px-4",
      active ? "border-primary font-medium text-foreground" : "border-transparent text-foreground/80 hover:border-border hover:bg-muted/60",
    );
  return (
    <nav className="app-tabs -mx-4 flex overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0" aria-label="Modulet">
      {tabs.map((t) => (
        <Link key={t.label} href={t.href} className={cls(t.active)} aria-current={t.active ? "page" : undefined}>
          <t.icon className="h-4 w-4" />
          {t.label}
        </Link>
      ))}
      {studioCount !== null && (
        <Link href="/studio/overview" className={cn(cls(false), "sm:ml-auto")}>
          <LayoutGrid className="h-4 w-4" />
          Të gjitha subjektet
          {studioCount > 1 && <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{studioCount}</span>}
        </Link>
      )}
    </nav>
  );
}
