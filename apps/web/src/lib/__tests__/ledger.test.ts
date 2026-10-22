import { describe, expect, it } from "vitest";
import { buildLedger, type LedgerInvoice } from "../ledger";

const inv = (o: Partial<LedgerInvoice> & { id: string; issue_date: string; total: number }): LedgerInvoice => ({
  number: o.id, nivf: null, paid_amount: 0, paid_at: null, payment_method: "bank", type: "normal", ...o,
});

describe("buildLedger", () => {
  it("faturat rrisin gjendjen, pagesat e ulin, në rend kronologjik", () => {
    const e = buildLedger([
      inv({ id: "B", issue_date: "2026-02-01", total: 500 }),
      inv({ id: "A", issue_date: "2026-01-10", total: 1000, paid_amount: 1000, paid_at: "2026-02-15" }),
    ]);
    expect(e.map((x) => [x.date, x.kind, x.balance])).toEqual([
      ["2026-01-10", "invoice", 1000],
      ["2026-02-01", "invoice", 1500],
      ["2026-02-15", "payment", 500],
    ]);
    expect(e[2].label).toBe("Pagesë për A · bankë");
  });

  it("në të njëjtën datë fatura vjen para pagesës (CASH)", () => {
    const e = buildLedger([inv({ id: "C", issue_date: "2026-03-01", total: 1195.08, paid_amount: 1195.08, paid_at: "2026-03-01", payment_method: "cash" })]);
    expect(e.map((x) => x.kind)).toEqual(["invoice", "payment"]);
    expect(e.at(-1)!.balance).toBe(0);
  });

  it("fatura korrigjuese negative del si kredi dhe nuk krijon pagesë", () => {
    const e = buildLedger([
      inv({ id: "N", issue_date: "2026-04-01", total: 2000 }),
      inv({ id: "K", issue_date: "2026-04-05", total: -500, paid_amount: 500, paid_at: "2026-04-05", type: "corrective" }),
    ]);
    expect(e).toHaveLength(2);
    expect(e[1]).toMatchObject({ debit: 0, credit: 500, balance: 1500, label: "Faturë K (korrigjuese)" });
  });

  it("pagesa e pjesshme dhe rrumbullakim në 2 shifra", () => {
    const e = buildLedger([inv({ id: "P", issue_date: "2026-05-01", total: 100.1, paid_amount: 33.37, paid_at: "2026-05-20" })]);
    expect(e.at(-1)!.balance).toBe(66.73);
  });

  it("paguar më shumë se totali kufizohet te totali", () => {
    const e = buildLedger([inv({ id: "X", issue_date: "2026-06-01", total: 50, paid_amount: 80, paid_at: "2026-06-02" })]);
    expect(e.at(-1)!.balance).toBe(0);
  });
});
