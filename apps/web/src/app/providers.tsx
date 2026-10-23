"use client";

import "dayjs/locale/sq";
import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { colorSchemeManager, theme } from "@/theme";
import { NavProgressProvider } from "@/components/app/nav-progress";

/** Mantine (tema e cis-client-2) + datat në shqip, java nga e hëna. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme} colorSchemeManager={colorSchemeManager} defaultColorScheme="auto">
      <DatesProvider settings={{ locale: "sq", firstDayOfWeek: 1, weekendDays: [0, 6] }}>
        <NavProgressProvider>{children}</NavProgressProvider>
      </DatesProvider>
    </MantineProvider>
  );
}
