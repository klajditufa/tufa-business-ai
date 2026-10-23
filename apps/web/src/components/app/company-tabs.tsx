"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge, Tabs } from "@mantine/core";
import {
  IconArchive, IconArrowDownLeft, IconArrowUpRight, IconBuildingBank, IconCalculator, IconLayoutDashboard, IconLayoutGrid,
  IconPercentage, IconSettings, IconWallet, type Icon,
} from "@tabler/icons-react";

/** Skedat e subjektit (Workspace i cis-client-2) + "Të gjitha subjektet" djathtas. */
export function CompanyTabs({ companyId, studioCount }: { companyId: string; studioCount: number | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const direction = useSearchParams().get("direction");
  const base = `/app/${companyId}`;
  const tabs: { value: string; href: string; label: string; icon: Icon; match: (p: string) => boolean }[] = [
    { value: "dashboard", href: `${base}/dashboard`, label: "Paneli", icon: IconLayoutDashboard, match: (p) => p.startsWith(`${base}/dashboard`) },
    { value: "sales", href: `${base}/invoices?direction=sale`, label: "Shitjet", icon: IconArrowUpRight, match: (p) => p === `${base}/invoices` && direction !== "purchase" },
    { value: "purchases", href: `${base}/invoices?direction=purchase`, label: "Blerjet", icon: IconArrowDownLeft, match: (p) => p === `${base}/invoices` && direction === "purchase" },
    { value: "vat", href: `${base}/vat`, label: "TVSH", icon: IconPercentage, match: (p) => p.startsWith(`${base}/vat`) },
    { value: "payroll", href: `${base}/payroll`, label: "Listëpagesa", icon: IconWallet, match: (p) => p.startsWith(`${base}/payroll`) },
    { value: "declarations", href: `${base}/declarations`, label: "Deklarimet", icon: IconBuildingBank, match: (p) => p.startsWith(`${base}/declarations`) },
    {
      value: "tools",
      href: `${base}/tools`,
      label: "Raporte & mjete",
      icon: IconCalculator,
      match: (p) => ["/tools", "/reports", "/parties", "/invoices/"].some((x) => p.startsWith(base + x)),
    },
    { value: "documents", href: `${base}/documents`, label: "Dokumentet", icon: IconArchive, match: (p) => p.startsWith(`${base}/documents`) },
    { value: "settings", href: `${base}/settings`, label: "Cilësimet", icon: IconSettings, match: (p) => p.startsWith(`${base}/settings`) },
  ];
  const active = tabs.find((tab) => tab.match(pathname))?.value ?? null;
  const hrefs = Object.fromEntries(tabs.map((tab) => [tab.value, tab.href]));
  hrefs.overview = "/studio/overview";

  return (
    <Tabs className="app-tabs" value={active} onChange={(value) => value && router.push(hrefs[value])}>
      <Tabs.List>
        {tabs.map(({ value, label, icon: TabIcon, href }) => (
          <Tabs.Tab key={value} value={value} leftSection={<TabIcon size={16} stroke={1.8} />} onMouseEnter={() => router.prefetch(href)}>
            {label}
          </Tabs.Tab>
        ))}
        {studioCount !== null && (
          <Tabs.Tab
            value="overview"
            ml={{ base: 0, sm: "auto" }}
            leftSection={<IconLayoutGrid size={16} stroke={1.8} />}
            rightSection={
              studioCount > 1 ? (
                <Badge size="sm" variant="light" color="gray" circle>
                  {studioCount}
                </Badge>
              ) : undefined
            }
          >
            Të gjitha subjektet
          </Tabs.Tab>
        )}
      </Tabs.List>
    </Tabs>
  );
}
