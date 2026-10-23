"use client";

import { useNav } from "@/components/app/nav-progress";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NativeSelect, NavLink, Paper, Stack, Text } from "@mantine/core";

/** Grupet e "Raporte & mjete", si menuja e cis-client-2. Disa lidhje çojnë te modulet ekzistuese. */
export function toolGroups(base: string) {
  return [
    {
      title: "Faturat & financat",
      items: [
        { href: `${base}/reports`, label: "Pasqyra e të ardhurave" },
        { href: `${base}/tools/items`, label: "Faturat sipas artikujve" },
        { href: `${base}/parties`, label: "Klientët & furnitorët" },
        { href: `${base}/invoices/bank`, label: "Rakordimi me bankën" },
      ],
    },
    {
      title: "Deklarimet",
      items: [
        { href: `${base}/vat`, label: "Përgatitja e TVSH-së" },
        { href: `${base}/tools/rent`, label: "Tatimi në burim · Qira" },
        { href: `${base}/tools/customs`, label: "Deklaratat doganore" },
      ],
    },
    {
      title: "Listëpagesa",
      items: [
        { href: `${base}/payroll`, label: "Listëpagesa · E-SIG 025" },
        { href: `${base}/tools/net-gross`, label: "Listëpagesa neto / bruto" },
      ],
    },
    {
      title: "Fiskalizimi",
      items: [{ href: `${base}/tools/registry`, label: "Operatorët, njësitë & pajisjet" }],
    },
  ];
}

export function ToolsMenu({ companyId }: { companyId: string }) {
  const pathname = usePathname();
  const { navigate } = useNav();
  const groups = toolGroups(`/app/${companyId}`);
  const all = groups.flatMap((g) => g.items);
  const active = all.find((i) => pathname.startsWith(i.href))?.href ?? "";
  return (
    <>
      {/* Telefon: zgjedhës */}
      <NativeSelect
        hiddenFrom="lg"
        aria-label="Mjeti"
        value={active}
        onChange={(e) => navigate(e.currentTarget.value)}
        data={groups.map((g) => ({ group: g.title, items: g.items.map((i) => ({ value: i.href, label: i.label })) }))}
      />
      {/* Desktop: menu e grupuar */}
      <Paper p="sm" visibleFrom="lg">
        <Stack gap="xs">
          {groups.map((g) => (
            <div key={g.title}>
              <Text size="xs" fw={600} c="dimmed" px="sm" pt="xs" pb={4}>
                {g.title}
              </Text>
              {g.items.map((i) => (
                <NavLink key={i.href} component={Link} href={i.href} label={i.label} active={active === i.href} variant="light" style={{ borderRadius: "var(--mantine-radius-md)" }} />
              ))}
            </div>
          ))}
        </Stack>
      </Paper>
    </>
  );
}
