import Link from "next/link";
import { Container, Group, Text, ThemeIcon } from "@mantine/core";
import { IconReceipt } from "@tabler/icons-react";
import { logoutAction } from "@/server/actions/auth";
import { CompanySwitcher } from "./company-switcher";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { t } from "@/lib/i18n";
import type { Company } from "@/server/services/companies";

/** Koka e aplikacionit (AppShell.Header i cis-client-2): logo, subjekti, tema, menuja. */
export function Header({
  company,
  companies,
  userName,
  role,
  isSuperAdmin = false,
  homeHref,
}: {
  company?: Company;
  companies: Company[];
  userName: string;
  role: string | null;
  isSuperAdmin?: boolean;
  homeHref?: string;
}) {
  const d = t();
  const studio = role === "org_owner" || role === "accountant" || isSuperAdmin;
  return (
    <header
      className="sticky top-0 z-30 h-[60px] border-b"
      style={{ background: "var(--mantine-color-body)", borderColor: "var(--mantine-color-default-border)" }}
    >
      <Container size={1440} h="100%" px={{ base: "sm", sm: "md" }}>
        <Group h="100%" justify="space-between" wrap="nowrap" gap="sm">
          <Link href={homeHref ?? (company ? `/app/${company.id}/dashboard` : "/app")} className="flex-none">
            <Group gap={10} wrap="nowrap">
              <ThemeIcon size={30} radius="md" color="indigo">
                <IconReceipt size={18} stroke={1.8} />
              </ThemeIcon>
              <Text fw={700} size="md" visibleFrom="md">
                {d.app.name}
              </Text>
            </Group>
          </Link>
          <Group gap="sm" wrap="nowrap" justify="flex-end" style={{ flex: 1, minWidth: 0 }}>
            <CompanySwitcher current={company} companies={companies} canAdd={studio} />
            <Group gap="sm" wrap="nowrap" visibleFrom="sm">
              <ThemeToggle />
            </Group>
            <UserMenu
              userName={userName}
              role={role}
              settingsHref={company ? `/app/${company.id}/settings` : undefined}
              studio={studio}
              superAdmin={isSuperAdmin}
              logout={logoutAction}
            />
          </Group>
        </Group>
      </Container>
    </header>
  );
}
