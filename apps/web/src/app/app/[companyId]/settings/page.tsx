import { createClient } from "@/lib/supabase/server";
import { getCompany, getMyRole } from "@/server/services/companies";
import { Badge, Card, CardTitle } from "@/components/ui";
import { CompanyEditForm } from "./company-edit-form";
import { MembersPanel } from "./members-panel";
import { t } from "@/lib/i18n";

export default async function SettingsPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const d = t();
  const supabase = await createClient();
  const [company, role, { data: integrations }, { data: members }, { data: invitations }, { data: perms }, { data: me }] = await Promise.all([
    getCompany(companyId),
    getMyRole(companyId),
    supabase.from("integrations").select("provider, status, last_sync_at").eq("company_id", companyId).order("provider"),
    supabase.from("company_memberships").select("user_id, role, users(full_name, email)").eq("company_id", companyId),
    supabase.from("invitations").select("id, email, company_role, expires_at, accepted_at").eq("company_id", companyId).is("accepted_at", null).order("created_at", { ascending: false }),
    supabase.rpc("my_permissions", { p_company_id: companyId }),
    supabase.auth.getUser(),
  ]);
  if (!company) return null;
  const canAdmin = (perms ?? []).some((p) => p.module === "companies" && p.action === "admin");

  const tone = { functional: "success", demo: "info", pending_integration: "warning", unavailable: "neutral" } as const;
  const providerLabel: Record<string, string> = {
    manual_import: "Import manual (Excel / CSV / XML)",
    selfcare: "Selfcare — fiskalizimi (DPT)",
    cats: "C@TS — deklarimet (DPT)",
    bank: "Ekstrakt bankar",
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <h1 className="text-2xl font-semibold">{d.nav.settings}</h1>

      <Card>
        <CardTitle>Subjekti · {company.nipt}</CardTitle>
        <div className="mt-3">
          <CompanyEditForm company={company} canEdit={canAdmin} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Roli yt në këtë subjekt: <b>{role}</b>. NIPT-i nuk ndryshohet; për korrigjim kontakto administratorin e platformës.</p>
      </Card>

      <Card>
        <CardTitle>Përdoruesit me akses</CardTitle>
        <div className="mt-3">
          <MembersPanel
            companyId={companyId}
            members={(members ?? []).map((m) => ({ userId: m.user_id, role: m.role, name: m.users?.full_name || "", email: m.users?.email || "" }))}
            invitations={(invitations ?? []).map((i) => ({ id: i.id, email: i.email, role: i.company_role ?? "", expiresAt: i.expires_at }))}
            canAdmin={canAdmin}
            myUserId={me.user?.id ?? ""}
            ownerName={role === "org_owner" ? "Ti (pronar i organizatës)" : null}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Integrimet</CardTitle>
        <ul className="mt-3 space-y-2 text-sm">
          {(integrations ?? []).map((i) => (
            <li key={i.provider} className="flex items-center justify-between gap-3">
              <span>{providerLabel[i.provider] ?? i.provider}</span>
              <Badge tone={tone[i.status]}>{d.status[i.status]}</Badge>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Lidhja direkte me portalet e DPT-së aktivizohet vetëm përmes një metode të autorizuar; deri atëherë përdoret eksporti manual.
        </p>
      </Card>

      <Card id="help">
        <CardTitle>{d.nav.help}</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">Komunikimi me llogaritarin brenda platformës vjen në Fazën 2 (portali i klientit).</p>
      </Card>
    </div>
  );
}
