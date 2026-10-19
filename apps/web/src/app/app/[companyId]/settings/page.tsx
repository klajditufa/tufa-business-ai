import { createClient } from "@/lib/supabase/server";
import { getCompany, getMyRole } from "@/server/services/companies";
import { Badge, Card, CardTitle } from "@/components/ui";
import { t } from "@/lib/i18n";

/** Parametrat e subjektit + statusi i integrimeve (siç është, pa pretenduar lidhje që nuk ekzistojnë). */
export default async function SettingsPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const d = t();
  const supabase = await createClient();
  const [company, role, { data: integrations }, { data: members }] = await Promise.all([
    getCompany(companyId),
    getMyRole(companyId),
    supabase.from("integrations").select("provider, status, last_sync_at").eq("company_id", companyId).order("provider"),
    supabase.from("company_memberships").select("role, users(full_name, email)").eq("company_id", companyId),
  ]);
  if (!company) return null;

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
        <CardTitle>Subjekti</CardTitle>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Row k="NIPT" v={company.nipt} />
          <Row k="Emri ligjor" v={company.legal_name} />
          <Row k="Emri tregtar" v={company.trade_name ?? "—"} />
          <Row k="Forma juridike" v={d.legalForms[company.legal_form]} />
          <Row k="Administratori" v={company.administrator_name ?? "—"} />
          <Row k="Qyteti" v={company.city ?? "—"} />
          <Row k="Regjimi tatimor" v={d.taxRegimes[company.tax_regime]} />
          <Row k="TVSH" v={company.vat_registered ? "I regjistruar" : "Jo"} />
          <Row k="Monedha bazë" v={company.base_currency} />
          <Row k="Roli yt" v={role ?? "—"} />
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">Ndryshimi i të dhënave vjen në dorëzimin #4.</p>
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

      <Card>
        <CardTitle>Përdoruesit me akses</CardTitle>
        <ul className="mt-3 space-y-2 text-sm">
          {(members ?? []).map((m, i) => (
            <li key={i} className="flex items-center justify-between gap-3">
              <span>{m.users?.full_name || m.users?.email}</span>
              <Badge>{m.role}</Badge>
            </li>
          ))}
          {(members ?? []).length === 0 && <li className="text-muted-foreground">Vetëm pronari i organizatës.</li>}
        </ul>
      </Card>

      <Card id="help">
        <CardTitle>{d.nav.help}</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">Komunikimi me llogaritarin brenda platformës vjen në Fazën 2 (portali i klientit).</p>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-1.5">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
