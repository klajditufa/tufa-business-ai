"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Loader, Tabs } from "@mantine/core";
import { useNav } from "@/components/app/nav-progress";
import { IconBuilding, IconCalendarCheck, IconLayoutGrid } from "@tabler/icons-react";

const TABS = [
  { value: "/studio/overview", label: "Të gjitha subjektet", icon: IconLayoutGrid },
  { value: "/studio", label: "Deklarimet", icon: IconCalendarCheck },
  { value: "/studio/companies", label: "Subjektet", icon: IconBuilding },
];

export function StudioTabs() {
  const pathname = usePathname();
  const { navigate, navigating } = useNav();
  const [clicked, setClicked] = useState<string | null>(null);
  const active = TABS.find((t) => (t.value === "/studio" ? pathname === "/studio" : pathname.startsWith(t.value)))?.value ?? null;
  const [lastActive, setLastActive] = useState(active);
  if (active !== lastActive) {
    setLastActive(active);
    setClicked(null);
  }
  return (
    <Tabs
      className="app-tabs"
      value={navigating && clicked ? clicked : active}
      onChange={(v) => {
        if (!v || v === active) return;
        setClicked(v);
        navigate(v);
      }}
    >
      <Tabs.List>
        {TABS.map((t) => (
          <Tabs.Tab
            key={t.value}
            value={t.value}
            leftSection={<t.icon size={16} stroke={1.8} />}
            rightSection={navigating && clicked === t.value && clicked !== active ? <Loader size={12} /> : undefined}
          >
            {t.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
