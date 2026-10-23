"use client";

import { useNav } from "@/components/app/nav-progress";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Badge, ColorSwatch, Group, Menu, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { IconBuildingStore, IconCheck, IconChevronDown, IconPlus, IconSearch } from "@tabler/icons-react";
import type { Company } from "@/server/services/companies";

const label = (c: Company) => c.trade_name || c.legal_name;

/**
 * Subjekti që tregon faqja dhe të tjerët (BusinessSwitcher i cis-client-2). Ndërrimi ruan modulin e hapur.
 */
export function CompanySwitcher({ current, companies, canAdd }: { current?: Company; companies: Company[]; canAdd?: boolean }) {
  const { navigate } = useNav();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const go = (c: Company) => {
    if (current && c.id === current.id) return;
    navigate(current && pathname.startsWith(`/app/${current.id}`) ? pathname.replace(`/app/${current.id}`, `/app/${c.id}`) : `/app/${c.id}/dashboard`);
  };
  const needle = q.trim().toLowerCase();
  const list = needle ? companies.filter((c) => `${label(c)} ${c.nipt}`.toLowerCase().includes(needle)) : companies;

  return (
    <Menu width={360} onClose={() => setQ("")}>
      <Menu.Target>
        <UnstyledButton
          px="sm"
          h={38}
          miw={0}
          maw={420}
          style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: "var(--mantine-radius-xl)" }}
        >
          <Group gap={8} wrap="nowrap">
            {current ? (
              <>
                <Group visibleFrom="sm">
                  <Badge color={current.vat_registered ? "teal" : "yellow"} variant="light" tt="uppercase" fw={700} size="sm">
                    {current.vat_registered ? "TVSH" : "Pa TVSH"}
                  </Badge>
                </Group>
                <ColorSwatch
                  hiddenFrom="sm"
                  size={10}
                  withShadow={false}
                  color={`var(--mantine-color-${current.vat_registered ? "teal" : "yellow"}-6)`}
                  style={{ flex: "none" }}
                />
                <Text size="sm" fw={600} truncate>
                  {label(current)}
                </Text>
                <Text size="xs" c="dimmed" ff="monospace" visibleFrom="sm">
                  {current.nipt}
                </Text>
              </>
            ) : (
              <Text size="sm" fw={600}>
                Zgjidh subjektin
              </Text>
            )}
            <IconChevronDown size={14} stroke={1.8} style={{ flex: "none" }} />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Ndërro subjektin · {companies.length} subjekte</Menu.Label>
        {companies.length > 6 && (
          <TextInput
            size="xs"
            mx={6}
            mb={6}
            placeholder="Kërko emër ose NIPT"
            leftSection={<IconSearch size={14} />}
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        )}
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {list.map((c) => (
            <Menu.Item
              key={c.id}
              leftSection={c.id === current?.id ? <IconCheck size={16} color="var(--mantine-color-teal-6)" /> : <IconBuildingStore size={16} />}
              onClick={() => go(c)}
            >
              <Stack gap={0}>
                <Text size="sm" fw={600}>
                  {label(c)}
                </Text>
                <Text size="xs" c="dimmed">
                  {[c.nipt, c.vat_registered ? "TVSH" : "pa TVSH"].join(" · ")}
                </Text>
              </Stack>
            </Menu.Item>
          ))}
          {list.length === 0 && (
            <Text size="sm" c="dimmed" px="sm" py={6}>
              Asnjë subjekt.
            </Text>
          )}
        </div>
        {canAdd && (
          <>
            <Menu.Divider />
            <Menu.Item leftSection={<IconPlus size={16} />} onClick={() => navigate("/studio/companies/new")}>
              Shto subjekt
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
