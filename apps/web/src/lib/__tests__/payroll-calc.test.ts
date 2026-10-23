import { describe, expect, it } from "vitest";
import { formatCents, grossToNet, netToGross, parseCents, rentWithholding, type PayrollProfile } from "../payroll-calc";

// Vlerat e pritura janë nxjerrë nga cis-client-2 (calculations.py, AL-2026-employee-v1), 2026-10-23.
const GOLDEN: [string, boolean, string, PayrollProfile, string, string, string, string, string][] = [
  ["50000", false, "0", "regular", "37900.00", "6500.00", "4750.00", "58350.00", "20450.00"],
  ["50000", true, "0", "regular", "44400.00", "0.00", "4750.00", "58350.00", "13950.00"],
  ["55000.55", true, "0", "regular", "46240.42", "2600.07", "5225.05", "64185.64", "17945.22"],
  ["100000", false, "0", "regular", "75800.00", "13000.00", "9500.00", "116700.00", "40900.00"],
  ["100000", true, "0", "regular", "79700.00", "9100.00", "9500.00", "116700.00", "37000.00"],
  ["186416", true, "0", "regular", "145203.33", "20334.08", "17709.52", "217547.47", "72344.14"],
  ["250000", true, "5000", "regular", "190590.48", "32450.00", "17709.52", "282212.40", "86621.92"],
  ["300000.01", false, "0", "under87Hours", "225376.91", "52000.00", "17523.10", "331011.83", "105634.92"],
];

const c = (s: string) => parseCents(s)!;
const plain = (cents: number) => formatCents(cents).replace(/,/g, "");

describe("grossToNet = cis-client-2", () => {
  it.each(GOLDEN)("bruto %s, statusi %s, pension %s, %s", (gross, ps, pen, profile, net, tax, social, cost, remit) => {
    const r = grossToNet(c(gross), { period: "2026-05", personalStatus: ps, pension: c(pen), profile });
    expect([plain(r.net), plain(r.incomeTax), plain(r.employeeSocial), plain(r.employerCost), plain(r.remittance)]).toEqual([
      net,
      tax,
      social,
      cost,
      remit,
    ]);
  });

  it("refuzon pagën nën minimumin dhe vitet pa rregulla të verifikuara", () => {
    expect(() => grossToNet(c("49999.99"), { period: "2026-05" })).toThrow(/50,000/);
    expect(() => grossToNet(c("60000"), { period: "2027-01" })).toThrow(/2026/);
  });
});

describe("netToGross = cis-client-2", () => {
  it.each([
    ["80000", false, ["105540.88", "105540.91"]],
    ["50000", true, ["59960.42", "59960.43", "60817.93", "60817.95"]],
    ["85150", true, ["107189.98"]],
    ["123456.78", false, ["162871.73", "162871.75"]],
  ] as const)("neto %s (statusi %s) → çdo bruto e saktë", (net, ps, grosses) => {
    const r = netToGross(c(net), { period: "2026-05", personalStatus: ps });
    expect(r.solutions.map((s) => plain(s.gross))).toEqual(grosses);
    expect(r.ambiguous).toBe(grosses.length > 1);
    for (const s of r.solutions) expect(s.net).toBe(c(net));
  });

  it("kur nuk ka zgjidhje të saktë jep më të afërtën", () => {
    const r = netToGross(c("10000"), { period: "2026-05" });
    expect(r.exact).toBe(false);
    expect(r.nearest?.gross).toBe(c("50000"));
  });
});

describe("qiraja dhe shumat", () => {
  it("baza = max(qira, minimumi referues)", () => {
    expect(rentWithholding(c("40000"), c("50000"), 15)).toEqual({ base: c("50000"), tax: c("7500"), net: c("32500"), referenceAdjustment: true });
  });
  it("lexon shumat në formatet e zakonshme", () => {
    expect(parseCents("100,000.50")).toBe(10000050);
    expect(parseCents("100.000,50")).toBe(10000050);
    expect(parseCents("1500,5")).toBe(150050);
    expect(parseCents("abc")).toBeNull();
    expect(formatCents(10000050)).toBe("100,000.50");
  });
});
