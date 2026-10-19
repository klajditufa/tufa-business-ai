import { logoutAction } from "@/server/actions/auth";
import { CompanySwitcher } from "./company-switcher";
import { Button } from "@/components/ui";
import { t } from "@/lib/i18n";
import type { Company } from "@/server/services/companies";

export function Header({
  company,
  companies,
  userName,
  role,
}: {
  company: Company;
  companies: Company[];
  userName: string;
  role: string | null;
}) {
  const d = t();
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card/90 px-4 py-3 backdrop-blur sm:px-6">
      <CompanySwitcher current={company} companies={companies} />
      <div className="ml-auto flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <div className="text-sm font-medium">{userName}</div>
          <div className="text-xs text-muted-foreground">{role ?? ""}</div>
        </div>
        <form action={logoutAction}>
          <Button variant="secondary" size="sm" type="submit">{d.nav.logout}</Button>
        </form>
      </div>
    </header>
  );
}
