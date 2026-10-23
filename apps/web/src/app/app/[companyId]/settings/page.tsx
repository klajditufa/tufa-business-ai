import { IconSettings as Settings } from "@tabler/icons-react";
import { PageTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompany, getMyRole } from "@/server/services/companies";
import { Badge, Card, CardTitle } from "@/components/ui";
import { CompanyEditForm } from "./company-edit-form";
import { MembersPanel } from "./members-panel";
import { ApiKeysPanel } from "./api-keys-panel";
import { headers } from "next/headers";
import { t } from "@/lib/i18n";

export default async function SettingsPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const d = t();
  const supabase = await createClient();
  const [company, role, { data: integrations }, { data: members }, { data: invitations }, { data: perms }, { data: me }, { data: apiKeys }, h] = await Promise.all([
    getCompany(companyId),
    getMyRole(companyId),
    supabase.from("integrations").select("provider, status, last_sync_at").eq("company_id", companyId).order("provider"),
    supabase.from("company_memberships").select("user_id, role, users(full_name, email)").eq("company_id", companyId),
    supabase.from("invitations").select("id, email, company_role, expires_at, accepted_at").eq("company_id", companyId).is("accepted_at", null).order("created_at", { ascending: false }),
    supabase.rpc("my_permissions", { p_company_id: companyId }),
    supabase.auth.getUser(),
    supabase.from("company_api_keys").select("id, name, key_prefix, created_at, last_used_at, revoked_at").eq("company_id", companyId).order("created_at", { ascending: false }),
    headers(),
  ]);
  if (!company) return null;
  const appUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "tufa-business-ai.vercel.app"}`;
  const canAdmin = (perms ?? []).some((p) => p.module === "companies" && p.action === "admin");

  const tone = { functional: "success", demo: "info", pending_integration: "warning", unavailable: "neutral" } as const;
  const providerLabel: Record<string, string> = {
    manual_import: "Import manual (Excel / CSV / XML)",
    selfcare: "Fiskalizimi (CIS / Selfcare, DPT) — faturat e shitjes dhe blerjes",
    cats: "C@TS — deklarimet (DPT)",
    bank: "Ekstrakt bankar",
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <PageTitle icon={Settings} title={d.nav.settings} subtitle="Të dhënat e subjektit, përdoruesit dhe lidhja me fiskalizimin." />

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
          Lidhja me DPT-në bëhet vetëm përmes shërbimit zyrtar të fiskalizimit (FiscalizationDataService), me certifikatën e biznesit — shih më poshtë.
        </p>
      </Card>

      <Card id="sync">
        <CardTitle>Sinkronizimi automatik me agjentin TUFA Sync (opsional)</CardTitle>
        <div className="mt-3">
          <ApiKeysPanel
            companyId={companyId}
            canAdmin={canAdmin}
            appUrl={appUrl}
            keys={(apiKeys ?? []).map((k) => ({ id: k.id, name: k.name, prefix: k.key_prefix, createdAt: k.created_at, lastUsedAt: k.last_used_at, revokedAt: k.revoked_at }))}
          />
        </div>
      </Card>

      <Card id="help">
        <CardTitle>{d.nav.help}</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">Komunikimi me llogaritarin brenda platformës vjen në Fazën 2 (portali i klientit).</p>
      </Card>
    </div>
  );
}
