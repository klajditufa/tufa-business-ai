"use client";


import { useNav } from "@/components/app/nav-progress";
import { ActionIcon, Group } from "@mantine/core";
import { MonthPickerInput } from "@mantine/dates";
import { IconCalendar, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

const pad = (n: number) => String(n).padStart(2, "0");

/** Muaji i periudhës: shigjeta + zgjedhës muaji me kalendar (Mantine Dates), në URL si ?period=VVVV-MM. */
export function MonthPicker({ year, month, basePath }: { year: number; month: number; basePath: string }) {
  const { navigate } = useNav();
  const go = (y: number, m: number) => {
    const sep = basePath.includes("?") ? "&" : "?";
    navigate(`${basePath}${sep}period=${y}-${pad(m)}`);
  };
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    go(d.getUTCFullYear(), d.getUTCMonth() + 1);
  };
  return (
    <Group gap={6} wrap="nowrap">
      <ActionIcon variant="default" size="lg" aria-label="Muaji i mëparshëm" onClick={() => shift(-1)}>
        <IconChevronLeft size={16} stroke={1.8} />
      </ActionIcon>
      <MonthPickerInput
        w={170}
        aria-label="Muaji"
        valueFormat="MMMM YYYY"
        leftSection={<IconCalendar size={16} stroke={1.8} />}
        value={`${year}-${pad(month)}-01`}
        onChange={(v) => {
          if (!v) return;
          const [y, m] = v.split("-").map(Number);
          go(y, m);
        }}
        styles={{ input: { textTransform: "capitalize" } }}
      />
      <ActionIcon variant="default" size="lg" aria-label="Muaji pasardhës" onClick={() => shift(1)}>
        <IconChevronRight size={16} stroke={1.8} />
      </ActionIcon>
    </Group>
  );
}
