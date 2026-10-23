"use client";

import { Center, SegmentedControl, Tooltip, useMantineColorScheme } from "@mantine/core";
import { IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";

/** Tema: sistemi / e çelët / e errët (ThemeSwitch i cis-client-2). */
export function ThemeToggle({ fullWidth = false }: { fullWidth?: boolean }) {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const options = [
    { value: "auto", label: "Sipas sistemit", icon: IconDeviceDesktop },
    { value: "light", label: "E çelët", icon: IconSun },
    { value: "dark", label: "E errët", icon: IconMoon },
  ] as const;
  return (
    <SegmentedControl
      size="xs"
      fullWidth={fullWidth}
      aria-label="Tema"
      value={colorScheme}
      onChange={(value) => setColorScheme(value as "auto" | "light" | "dark")}
      data={options.map(({ value, label, icon: Icon }) => ({
        value,
        label: (
          <Tooltip label={label}>
            <Center h={20} w={20} mx="auto" aria-label={label}>
              <Icon size={15} stroke={1.8} />
            </Center>
          </Tooltip>
        ),
      }))}
    />
  );
}
