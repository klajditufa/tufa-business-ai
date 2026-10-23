import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import { CompanySwitcher } from "./company-switcher";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { t } from "@/lib/i18n";
import type { Company } from "@/server/services/companies";

/** Koka e aplikacionit (si cis-client-2): logo, zgjedhësi i subjektit, tema, menuja e përdoruesit. */
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
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-9">
        <Link href={homeHref ?? (company ? `/app/${company.id}/dashboard` : "/app")} className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ReceiptText className="h-[18px] w-[18px]" />
          </span>
          <span className="hidden text-lg font-bold tracking-tight sm:inline">{d.app.name}</span>
        </Link>
        <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
          <CompanySwitcher current={company} companies={companies} />
          <ThemeToggle className="hidden sm:inline-flex" />
          <UserMenu
            userName={userName}
            role={role}
            settingsHref={company ? `/app/${company.id}/settings` : undefined}
            studio={role === "org_owner" || role === "accountant"}
            superAdmin={isSuperAdmin}
            logout={logoutAction}
          />
        </div>
      </div>
    </header>
  );
}
