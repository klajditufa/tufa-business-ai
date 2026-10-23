/**
 * Llogaritësi neto/bruto për punëmarrës të rregullt, muaj i plotë (Shqipëri, 2026).
 *
 * Përshtatur nga cis-client-2 (`cis_client/accounting/calculations.py`, rregulli AL-2026-employee-v1):
 *  - të gjitha shumat në qindarka (numra të plotë), asnjë float në llogaritje;
 *  - rrumbullakim 0.01 half-up për çdo komponent;
 *  - zbritja personale (50/35/30 mijë) aplikohet VETËM kur punonjësi ka nënshkruar deklaratën e statusit;
 *  - neto → bruto kthen çdo zgjidhje të saktë (pranë pragjeve mund të ketë më shumë se një).
 *
 * Është vlerësim. Shuma zyrtare është ajo e listëpagesës E-SIG 025 në C@TS.
 */

export const PAYROLL_RULES = {
  id: "AL-2026-employee-v1",
  year: 2026,
  verifiedOn: "2026-10-22",
  minimumGross: 50_000_00,
  socialCap: 186_416_00,
  incomeTaxThreshold: 170_000_00,
  /** Norma në përmijë (130 = 13%). */
  incomeTaxRates: [130, 230] as const,
  profiles: {
    regular: { employeeSocial: 95, employerSocial: 150 },
    under87Hours: { employeeSocial: 94, employerSocial: 139 },
  },
  employeeHealth: 17,
  employerHealth: 17,
  sources: [
    "https://www.tatime.gov.al/d/8/45/45/1914/nga-1-janari-2026-rritet-paga-minimale-dhe-maksimale",
    "https://tatime.gov.al/wp-content/uploads/2026/09/Ligj-Nr.-29-2023-Per-Tatimin-mbi-te-Ardhurat-i-ndryshuar.pdf",
    "https://www.issh.gov.al/wp-content/uploads/2023/09/VKM_77_28012015_perditesuar-2-2.pdf",
  ],
} as const;

export type PayrollProfile = keyof typeof PAYROLL_RULES.profiles;

export type PayrollInput = {
  /** "YYYY-MM" */
  period: string;
  personalStatus?: boolean;
  /** Pensioni vullnetar mujor, në qindarka. */
  pension?: number;
  profile?: PayrollProfile;
};

/** Të gjitha vlerat në qindarka. */
export type PayrollResult = {
  ruleId: string;
  gross: number;
  socialBase: number;
  personalDeduction: number;
  pension: number;
  taxable: number;
  employeeSocial: number;
  employeeHealth: number;
  incomeTax: number;
  employerSocial: number;
  employerHealth: number;
  net: number;
  employerCost: number;
  remittance: number;
};

export class PayrollCalcError extends Error {
  constructor(
    message: string,
    readonly field: string,
  ) {
    super(message);
  }
}

const MAX_GROSS = 1_000_000_000_00;

/** a·n / d e rrumbullakosur half-up (a, n, d ≥ 0, numra të plotë). */
function mulDiv(a: number, n: number, d: number): number {
  return Math.floor((2 * a * n + d) / (2 * d));
}

/** "100000", "100000.5", "100,000.50", "100.000,50" → qindarka; null nëse nuk është shumë e vlefshme. */
export function parseCents(input: string): number | null {
  let s = input.trim().replace(/\s|ALL|Lekë?/gi, "");
  if (!s) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+(,\d{1,2})$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  const m = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  return `${sign}${whole}.${String(abs % 100).padStart(2, "0")}`;
}

function parameters({ period, profile = "regular", pension = 0 }: PayrollInput) {
  if (!/^2026-(0[1-9]|1[0-2])$/.test(period)) {
    throw new PayrollCalcError("Rregullat e verifikuara mbulojnë vetëm muajt e vitit 2026.", "period");
  }
  if (!(profile in PAYROLL_RULES.profiles)) throw new PayrollCalcError("Zgjidh një profil të mbështetur.", "profile");
  if (!Number.isInteger(pension) || pension < 0) throw new PayrollCalcError("Pensioni duhet të jetë shumë pozitive.", "pension");
  if (pension > PAYROLL_RULES.minimumGross) {
    throw new PayrollCalcError("Pensioni vullnetar kalon kufirin mujor (paga minimale).", "pension");
  }
  return { rates: PAYROLL_RULES.profiles[profile], pension };
}

/** Bruto → neto, për një muaj të plotë. `gross` në qindarka. */
export function grossToNet(gross: number, input: PayrollInput): PayrollResult {
  const { rates, pension } = parameters(input);
  if (!Number.isInteger(gross) || gross < PAYROLL_RULES.minimumGross || gross > MAX_GROSS) {
    throw new PayrollCalcError("Paga bruto duhet të jetë të paktën 50,000 ALL (paga minimale 2026).", "gross");
  }
  let deduction = 0;
  if (input.personalStatus) deduction = gross <= 50_000_00 ? 50_000_00 : gross <= 60_000_00 ? 35_000_00 : 30_000_00;
  const taxable = Math.max(0, gross - deduction - pension);
  const threshold = PAYROLL_RULES.incomeTaxThreshold;
  const [low, high] = PAYROLL_RULES.incomeTaxRates;
  const incomeTax = mulDiv(Math.min(taxable, threshold) * low + Math.max(0, taxable - threshold) * high, 1, 1000);
  const socialBase = Math.min(gross, PAYROLL_RULES.socialCap);
  const employeeSocial = mulDiv(socialBase, rates.employeeSocial, 1000);
  const employerSocial = mulDiv(socialBase, rates.employerSocial, 1000);
  const employeeHealth = mulDiv(gross, PAYROLL_RULES.employeeHealth, 1000);
  const employerHealth = mulDiv(gross, PAYROLL_RULES.employerHealth, 1000);
  const net = gross - employeeSocial - employeeHealth - incomeTax - pension;
  if (net < 0) throw new PayrollCalcError("Pensioni i zgjedhur kalon pagën neto në dispozicion.", "pension");
  return {
    ruleId: PAYROLL_RULES.id,
    gross,
    socialBase,
    personalDeduction: deduction,
    pension,
    taxable,
    employeeSocial,
    employeeHealth,
    incomeTax,
    employerSocial,
    employerHealth,
    net,
    employerCost: gross + employerSocial + employerHealth,
    remittance: employeeSocial + employeeHealth + employerSocial + employerHealth + incomeTax,
  };
}

export type NetToGross = {
  requestedNet: number;
  exact: boolean;
  ambiguous: boolean;
  solutions: PayrollResult[];
  /** Kur nuk ka zgjidhje të saktë: bruto me neto më të afërt. */
  nearest: PayrollResult | null;
};

/**
 * Neto → bruto. Kërkon veç e veç në çdo zonë monotone (zbritjet personale krijojnë kërcime poshtë),
 * dhe kontrollon fqinjësinë e çdo kufiri, sepse rrumbullakimi për komponent mund të prishë monotoninë.
 */
export function netToGross(net: number, input: PayrollInput): NetToGross {
  const { pension } = parameters(input);
  if (!Number.isInteger(net) || net < 0 || net > 900_000_000_00) {
    throw new PayrollCalcError("Paga neto është jashtë kufijve të llogaritësit.", "net");
  }
  const breaks = [
    ...new Set([
      50_000_00,
      60_000_00,
      PAYROLL_RULES.socialCap,
      PAYROLL_RULES.incomeTaxThreshold + pension + (input.personalStatus ? 30_000_00 : 0),
      MAX_GROSS,
    ]),
  ].sort((a, b) => a - b);
  const solutions = new Map<number, PayrollResult>();
  let nearest: PayrollResult | null = null;
  const consider = (gross: number): PayrollResult | null => {
    let r: PayrollResult;
    try {
      r = grossToNet(gross, input);
    } catch {
      return null;
    }
    if (!nearest || Math.abs(r.net - net) < Math.abs(nearest.net - net)) nearest = r;
    if (r.net === net) solutions.set(r.gross, r);
    return r;
  };
  let lower = PAYROLL_RULES.minimumGross;
  for (const upper of breaks) {
    if (upper < lower) continue;
    let lo = lower;
    let hi = upper;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const r = consider(mid);
      if (!r) {
        lo = mid + 1;
        continue;
      }
      if (r.net >= net) hi = mid - 1;
      else lo = mid + 1;
    }
    for (let g = Math.max(lower, lo - 10); g <= Math.min(upper, lo + 10); g++) consider(g);
    lower = upper + 1;
  }
  const list = [...solutions.values()].sort((a, b) => a.gross - b.gross);
  return {
    requestedNet: net,
    exact: list.length > 0,
    ambiguous: list.length > 1,
    solutions: list,
    nearest: list.length ? null : nearest,
  };
}

/** Tatimi në burim për qiranë: baza = max(qiraja kontraktuale, minimumi referues). Shumat në qindarka, norma në %. */
export function rentWithholding(gross: number, referenceMinimum: number, ratePercent = 15) {
  if (ratePercent < 0 || ratePercent >= 100) throw new PayrollCalcError("Norma duhet të jetë nën 100%.", "rate");
  const base = Math.max(gross, referenceMinimum);
  const tax = mulDiv(base, Math.round(ratePercent * 100), 10_000);
  return { base, tax, net: gross >= tax ? gross - tax : null, referenceAdjustment: referenceMinimum > gross };
}
