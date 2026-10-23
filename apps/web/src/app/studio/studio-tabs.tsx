"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tabs } from "@mantine/core";
import { IconBuilding, IconCalendarCheck, IconLayoutGrid } from "@tabler/icons-react";

const TABS = [
  { value: "/studio/overview", label: "Të gjitha subjektet", icon: IconLayoutGrid },
  { value: "/studio", label: "Deklarimet", icon: IconCalendarCheck },
  { value: "/studio/companies", label: "Subjektet", icon: IconBuilding },
];

export function StudioTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const active = TABS.find((t) => (t.value === "/studio" ? pathname === "/studio" : pathname.startsWith(t.value)))?.value ?? null;
  return (
    <Tabs className="app-tabs" value={active} onChange={(v) => v && router.push(v)}>
      <Tabs.List>
        {TABS.map((t) => (
          <Tabs.Tab key={t.value} value={t.value} leftSection={<t.icon size={16} stroke={1.8} />}>
            {t.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
