import { createClient } from "@/lib/supabase/server";
import { Badge, Card } from "@/components/ui";
import { date } from "@/lib/format";
import { RuleEditor } from "./rule-editor";

const KIND_LABEL: Record<string, string> = {
  vat_rate: "Normat e TVSH-së", vat_exempt: "TVSH: përjashtime dhe pragu", profit_tax: "Tatimi mbi fitimin",
  simplified_tax: "Biznesi i vogël", withholding: "Tatimi në burim", dividend_tax: "Dividendi",
  social_contrib: "Sigurimet shoqërore", health_contrib: "Sigurimet shëndetësore", min_wage: "Paga minimale",
  max_wage: "Paga maksimale", payroll_tax_bracket: "Tatimi mbi pagën (TAP)",
};

/** Vlerat kryesore të rregullit në një rresht të lexueshëm. */
function summary(p: Record<string, unknown>) {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(p)) {
    if (k === "label" || k === "currency") continue;
    if (Array.isArray(v)) parts.push(`${k}: ${v.length} shkallë`);
    else if (typeof v === "number") parts.push(`${k}: ${v.toLocaleString("sq-AL")}${/rate|employee|employer|self/.test(k) ? "%" : ""}`);
    else if (v != null && typeof v !== "object") parts.push(`${k}: ${v}`);
  }
  return parts.join(" · ");
}

/**
 * Rregullat tatimore globale: çdo vlerë me datë hyrjeje në fuqi dhe burim ligjor.
 * Konfirmimi / ndryshimi bëhet vetëm nga administratori (RPC me kontroll), dhe regjistrohet në audit.
 */
export default async function TaxRulesPage() {
  const supabase = await createClient();
  const { data: rules, error } = await supabase
    .from("tax_rules")
    .select("id, kind, code, params, valid_from, valid_to, source, confirmed, confirmed_at")
    .is("company_id", null)
    .order("kind")
    .order("code")
    .order("valid_from", { ascending: false });
  const today = new Date().toISOString().slice(0, 10);
  const list = rules ?? [];
  const pending = list.filter((r) => !r.confirmed && (!r.valid_to || r.valid_to >= today)).length;
  const groups = [...new Set(list.map((r) => r.kind))];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Rregullat tatimore</h1>
        <p className="text-sm text-muted-foreground">
          Normat, pragjet dhe kontributet që përdorin TVSH-ja, raportet dhe deklarimet. Një ndryshim ligjor regjistrohet si vlerë e re nga data e hyrjes në fuqi,
          kështu periudhat e kaluara llogariten me vlerën e vjetër.
        </p>
        {pending > 0 && <p className="mt-2 text-sm font-medium text-warning">{pending} rregulla në fuqi presin konfirmim.</p>}
      </div>
      {error && <p className="text-sm text-danger">{error.message}</p>}

      {groups.map((kind) => (
        <Card key={kind} className="p-0">
          <div className="border-b border-border px-4 py-3 font-medium">{KIND_LABEL[kind] ?? kind}</div>
          <ul className="divide-y divide-border">
            {list.filter((r) => r.kind === kind).map((r) => {
              const p = (r.params ?? {}) as Record<string, unknown>;
              const current = r.valid_from <= today && (!r.valid_to || r.valid_to >= today);
              const future = r.valid_from > today;
              return (
                <li key={r.id} className={`grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] ${!current && !future ? "opacity-60" : ""}`}>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{String(p.label ?? r.code)}</span>
                      {r.confirmed ? <Badge tone="success">e konfirmuar</Badge> : <Badge tone="warning">e pakonfirmuar</Badge>}
                      {current && <Badge tone="info">në fuqi</Badge>}
                      {future && <Badge tone="neutral">nga {date(r.valid_from)}</Badge>}
                      {!current && !future && <Badge tone="neutral">historike</Badge>}
                    </div>
                    <div className="text-sm tabular">{summary(p)}</div>
                    <div className="text-xs text-muted-foreground">
                      {date(r.valid_from)} – {r.valid_to ? date(r.valid_to) : "në vazhdim"} · {r.source ?? "pa burim"} · kodi <code>{r.code}</code>
                    </div>
                  </div>
                  <RuleEditor id={r.id} params={p} source={r.source} confirmed={r.confirmed} current={current || future} />
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
