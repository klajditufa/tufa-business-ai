import { Calculator } from "lucide-react";
import { ToolsMenu } from "./tools-menu";

/** "Raporte & mjete": menu e grupuar majtas (zgjedhës në telefon), mjeti djathtas. */
export default async function ToolsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card">
          <Calculator className="h-5 w-5 text-muted-foreground" />
        </span>
        <h1 className="text-2xl font-semibold">Raporte & mjete</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ToolsMenu companyId={companyId} />
        </aside>
        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
