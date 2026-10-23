"use client";

import { useMemo, useState } from "react";
import { Alert, Card, Input, Label, Select } from "@/components/ui";
import {
  PAYROLL_RULES,
  PayrollCalcError,
  formatCents,
  grossToNet,
  netToGross,
  parseCents,
  type PayrollProfile,
  type PayrollResult,
} from "@/lib/payroll-calc";
import { cn } from "@/lib/utils";

const ROWS: [keyof PayrollResult, string, boolean?][] = [
  ["gross", "Paga bruto", true],
  ["employeeSocial", "Sigurime shoqërore · punëmarrësi"],
  ["employeeHealth", "Sigurime shëndetësore · punëmarrësi"],
  ["personalDeduction", "Zbritja personale (me deklaratë)"],
  ["pension", "Pension vullnetar"],
  ["taxable", "Të ardhura të tatueshme"],
  ["incomeTax", "TAP"],
  ["net", "Paga neto", true],
  ["employerSocial", "Sigurime shoqërore · punëdhënësi"],
  ["employerHealth", "Sigurime shëndetësore · punëdhënësi"],
  ["employerCost", "Kostoja e punëdhënësit", true],
  ["remittance", "Për t'u derdhur (kontribute + TAP)", true],
];

export function NetGrossCalculator({ defaultPeriod }: { defaultPeriod: string }) {
  const [mode, setMode] = useState<"gross" | "net">("gross");
  const [period, setPeriod] = useState(defaultPeriod);
  const [amount, setAmount] = useState("100000");
  const [profile, setProfile] = useState<PayrollProfile>("regular");
  const [personalStatus, setPersonalStatus] = useState(false);
  const [pension, setPension] = useState("0");

  const outcome = useMemo(() => {
    const value = parseCents(amount);
    const pensionCents = parseCents(pension || "0");
    if (value === null) return { error: "Shkruaj shumën, p.sh. 100000 ose 100,000.50." };
    if (pensionCents === null) return { error: "Pensioni vullnetar nuk është shumë e vlefshme." };
    const input = { period, profile, personalStatus, pension: pensionCents };
    try {
      if (mode === "gross") return { results: [grossToNet(value, input)], exact: true };
      const r = netToGross(value, input);
      return { results: r.exact ? r.solutions : r.nearest ? [r.nearest] : [], exact: r.exact, ambiguous: r.ambiguous };
    } catch (e) {
      return { error: e instanceof PayrollCalcError ? e.message : "Llogaritja dështoi." };
    }
  }, [mode, period, amount, profile, personalStatus, pension]);

  const months = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`);

  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
          {(["gross", "net"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn("rounded-md px-3 py-1.5", mode === m ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}
            >
              {m === "gross" ? "Bruto → neto" : "Neto → bruto"}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="ng-amount">{mode === "gross" ? "Paga bruto (ALL)" : "Paga neto (ALL)"}</Label>
            <Input id="ng-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ng-period">Muaji</Label>
            <Select id="ng-period" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {m.slice(5)}/{m.slice(0, 4)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ng-profile">Profili</Label>
            <Select id="ng-profile" value={profile} onChange={(e) => setProfile(e.target.value as PayrollProfile)}>
              <option value="regular">Punëmarrës i rregullt</option>
              <option value="under87Hours">Nën 87 orë në muaj</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="ng-pension">Pension vullnetar (ALL)</Label>
            <Input id="ng-pension" inputMode="decimal" value={pension} onChange={(e) => setPension(e.target.value)} />
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={personalStatus} onChange={(e) => setPersonalStatus(e.target.checked)} />
          <span>
            Punonjësi ka nënshkruar <b>deklaratën e statusit personal</b> te ky punëdhënës (zbritja 50.000 / 35.000 / 30.000 ALL).
            <span className="block text-xs text-muted-foreground">Pa deklaratë, zbritja nuk aplikohet.</span>
          </span>
        </label>
      </Card>

      {"error" in outcome && outcome.error ? (
        <Alert tone="warning">{outcome.error}</Alert>
      ) : (
        <>
          {mode === "net" && outcome.results && outcome.results.length > 0 && (
            <Alert tone={outcome.exact ? (outcome.ambiguous ? "warning" : "success") : "warning"}>
              {!outcome.exact
                ? "Asnjë pagë bruto nuk jep saktësisht këtë neto (rrumbullakimi). Më poshtë është më e afërta."
                : outcome.ambiguous
                  ? `Kjo neto del nga ${outcome.results.length} paga bruto të ndryshme (pranë pragjeve ose nga rrumbullakimi). Zgjidh atë që përputhet me kontratën.`
                  : "U gjet një pagë bruto e saktë."}
            </Alert>
          )}
          <div className="grid gap-4 xl:grid-cols-2">
            {(outcome.results ?? []).map((r) => (
              <Card key={r.gross} className="p-0">
                <table className="w-full text-sm">
                  <tbody>
                    {ROWS.map(([key, label, strong]) => (
                      <tr key={key} className="border-t border-border first:border-t-0">
                        <td className={cn("px-4 py-2", strong && "font-medium")}>{label}</td>
                        <td className={cn("px-4 py-2 text-right tabular", strong && "font-semibold")}>{formatCents(r[key] as number)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Vlerësim për muaj të plotë sipas rregullit {PAYROLL_RULES.id} (verifikuar më {PAYROLL_RULES.verifiedOn.split("-").reverse().join(".")}):
        paga minimale 50.000, maksimale për kontribute 186.416, kontribute 9,5% + 15% dhe 1,7% + 1,7%, TAP 13% deri në 170.000 të
        tatueshme dhe 23% mbi to. Nuk mbulon muaj të pjesshëm, disa punëdhënës, të vetëpunësuar apo pensionistë. Shuma zyrtare është
        ajo e listëpagesës E-SIG 025 në C@TS. Burimet:{" "}
        {PAYROLL_RULES.sources.map((s, i) => (
          <a key={s} href={s} target="_blank" rel="noreferrer" className="underline">
            [{i + 1}]
          </a>
        ))}
      </p>
    </div>
  );
}
