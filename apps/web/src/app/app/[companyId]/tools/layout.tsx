import { IconCalculator as Calculator } from "@tabler/icons-react";
import { PageTitle } from "@/components/ui";
import { getCompany } from "@/server/services/companies";
import { ToolsMenu } from "./tools-menu";

/** "Raporte & mjete": menu e grupuar majtas (zgjedhës në telefon), mjeti djathtas. */
export default async function ToolsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const company = await getCompany(companyId);
  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      <PageTitle icon={Calculator} title="Raporte & mjete" />
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ToolsMenu companyId={companyId} vat={company?.vat_registered ?? true} withholding={company?.withholding_agent ?? false} />
        </aside>
        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
