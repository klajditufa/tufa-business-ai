"use client";

import { useRouter } from "next/navigation";
import { ActionIcon, Avatar, Menu, Text } from "@mantine/core";
import { IconAdjustmentsHorizontal, IconBuilding, IconLifebuoy, IconLogout, IconScale, IconSettings } from "@tabler/icons-react";
import { ThemeToggle } from "./theme-toggle";

/** Menuja e përdoruesit; në telefon mban edhe temën (SettingsMenu i cis-client-2). */
export function UserMenu({
  userName,
  role,
  settingsHref,
  studio,
  superAdmin,
  logout,
}: {
  userName: string;
  role: string | null;
  settingsHref?: string;
  studio: boolean;
  superAdmin: boolean;
  logout: () => Promise<void>;
}) {
  const router = useRouter();
  const initials = userName.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
  return (
    <Menu width={240}>
      <Menu.Target>
        <div>
          <ActionIcon size="lg" variant="default" aria-label="Menuja" hiddenFrom="sm">
            <IconAdjustmentsHorizontal size={18} stroke={1.8} />
          </ActionIcon>
          <ActionIcon size="lg" variant="transparent" aria-label="Menuja" visibleFrom="sm">
            <Avatar size={34} color="indigo" radius="xl">
              {initials}
            </Avatar>
          </ActionIcon>
        </div>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>
          <Text size="sm" fw={600} c="var(--mantine-color-text)" truncate>
            {userName}
          </Text>
          {role && <Text size="xs">Roli: {role}</Text>}
        </Menu.Label>
        <div className="px-2 pb-2 sm:hidden">
          <ThemeToggle fullWidth />
        </div>
        <Menu.Divider />
        {settingsHref && (
          <Menu.Item leftSection={<IconSettings size={16} />} onClick={() => router.push(settingsHref)}>
            Cilësimet e subjektit
          </Menu.Item>
        )}
        {studio && (
          <Menu.Item leftSection={<IconBuilding size={16} />} onClick={() => router.push("/studio")}>
            Paneli i studios
          </Menu.Item>
        )}
        {superAdmin && (
          <Menu.Item leftSection={<IconScale size={16} />} onClick={() => router.push("/admin/tax-rules")}>
            Rregullat tatimore
          </Menu.Item>
        )}
        {settingsHref && (
          <Menu.Item leftSection={<IconLifebuoy size={16} />} onClick={() => router.push(`${settingsHref}#help`)}>
            Ndihmë
          </Menu.Item>
        )}
        <Menu.Divider />
        <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={() => void logout()}>
          Dil
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
