import { createClient } from "@/lib/supabase/server";
import { Alert, Badge, Card, Empty } from "@/components/ui";

export const metadata = { title: "Operatorët, njësitë & pajisjet" };

type Operator = { name?: string; opCode?: string; idNumber?: string; validFrom?: string; validTo?: string };
type Unit = { BUCode?: string; BUName?: string; BUStreetName?: string; BUSerialNumber?: string; BUValidFrom?: string; BUValidTo?: string };
type Tcr = { TCRCode?: string; TCRIntID?: string; BusinUnitCode?: string; Type?: string; SoftCode?: string; MaintainerCode?: string; ValidFrom?: string; ValidTo?: string };

const day = (v?: string | null) => (v ? v.slice(0, 10).split("-").reverse().join(".") : "—");
const active = (to?: string | null) => !to || new Date(to) >= new Date();

function Section({ title, syncedAt, children, count }: { title: string; syncedAt: string | null; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold">{title} <span className="text-sm font-normal text-muted-foreground">({count})</span></h3>
        <span className="text-xs text-muted-foreground">{syncedAt ? `Sinkronizuar ${new Date(syncedAt).toLocaleString("sq-AL")}` : "Ende pa sinkronizuar"}</span>
      </div>
      {children}
    </div>
  );
}

/** Regjistrat e fiskalizimit (CIS), pamja e fundit e dërguar nga agjenti TUFA Sync me certifikatën e subjektit. */
export default async function RegistryPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("company_registry").select("kind, rows, synced_at").eq("company_id", companyId);
  const get = <T,>(kind: string) => {
    const r = (data ?? []).find((x) => x.kind === kind);
    return { rows: (r?.rows ?? []) as T[], syncedAt: r?.synced_at ?? null };
  };
  const operators = get<Operator>("operators");
  const units = get<Unit>("units");
  const tcrs = get<Tcr>("tcrs");
  const none = !operators.syncedAt && !units.syncedAt && !tcrs.syncedAt;

  const th = "px-3 py-2";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Operatorët, njësitë & pajisjet</h2>
        <p className="text-sm text-muted-foreground">Siç janë të regjistruara në sistemin e fiskalizimit (CIS) për këtë subjekt.</p>
      </div>
      {error && <Alert tone="danger">{error.message}</Alert>}
      {none && (
        <Alert tone="info">
          Këto lexohen vetëm me certifikatën e subjektit, që mbetet në kompjuterin e tij. Në atë kompjuter, brenda dosjes <code>tufa-sync</code>, nis{" "}
          <code className="rounded bg-background px-1">./start.sh push-registry</code> me të njëjtin çelës API si për faturat.
        </Alert>
      )}

      <Section title="Njësitë e biznesit" syncedAt={units.syncedAt} count={units.rows.length}>
        {units.rows.length === 0 ? <Empty title="Asnjë njësi." /> : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-[11px] uppercase text-muted-foreground">
                <tr><th className={th}>Kodi</th><th className={th}>Emri</th><th className={th}>Adresa</th><th className={th}>Nga</th><th className={th}>Deri</th></tr>
              </thead>
              <tbody>
                {units.rows.map((u, i) => (
                  <tr key={u.BUCode ?? i} className="border-t border-border">
                    <td className={`${th} font-mono text-xs`}>{u.BUCode}</td>
                    <td className={th}>{u.BUName}</td>
                    <td className={th}>{u.BUStreetName}</td>
                    <td className={`${th} tabular`}>{day(u.BUValidFrom)}</td>
                    <td className={`${th} tabular`}>{day(u.BUValidTo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </Section>

      <Section title="Pajisjet fiskale (TCR)" syncedAt={tcrs.syncedAt} count={tcrs.rows.length}>
        {tcrs.rows.length === 0 ? <Empty title="Asnjë pajisje." /> : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-[11px] uppercase text-muted-foreground">
                <tr><th className={th}>Kodi TCR</th><th className={th}>ID e brendshme</th><th className={th}>Njësia</th><th className={th}>Lloji</th><th className={th}>Softueri</th><th className={th}>Nga</th><th className={th}>Statusi</th></tr>
              </thead>
              <tbody>
                {tcrs.rows.map((t, i) => (
                  <tr key={t.TCRCode ?? i} className="border-t border-border">
                    <td className={`${th} font-mono text-xs`}>{t.TCRCode}</td>
                    <td className={th}>{t.TCRIntID}</td>
                    <td className={`${th} font-mono text-xs`}>{t.BusinUnitCode}</td>
                    <td className={th}>{t.Type}</td>
                    <td className={`${th} font-mono text-xs`}>{t.SoftCode}</td>
                    <td className={`${th} tabular`}>{day(t.ValidFrom)}</td>
                    <td className={th}>{active(t.ValidTo) ? <Badge tone="success">Aktive</Badge> : <Badge>Deri {day(t.ValidTo)}</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </Section>

      <Section title="Operatorët" syncedAt={operators.syncedAt} count={operators.rows.length}>
        {operators.rows.length === 0 ? <Empty title="Asnjë operator." /> : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-[11px] uppercase text-muted-foreground">
                <tr><th className={th}>Emri</th><th className={th}>Kodi i operatorit</th><th className={th}>Nr. personal</th><th className={th}>Nga</th><th className={th}>Statusi</th></tr>
              </thead>
              <tbody>
                {operators.rows.map((o, i) => (
                  <tr key={o.opCode ?? i} className="border-t border-border">
                    <td className={th}>{o.name}</td>
                    <td className={`${th} font-mono text-xs`}>{o.opCode}</td>
                    <td className={`${th} font-mono text-xs`}>{o.idNumber}</td>
                    <td className={`${th} tabular`}>{day(o.validFrom)}</td>
                    <td className={th}>{active(o.validTo) ? <Badge tone="success">Aktiv</Badge> : <Badge>Deri {day(o.validTo)}</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </Section>
    </div>
  );
}
