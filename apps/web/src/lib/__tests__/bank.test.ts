import { describe, expect, it } from "vitest";
import items from "./fixtures-statement.json";
import { itemsToLines, parseAmount, parseDate, parseStatement, type BankTx } from "../bank-statement";
import { invoiceRefs, matchTransactions, type OpenInvoice } from "../bank-match";

describe("parseAmount / parseDate", () => {
  it("formatet e shumave", () => {
    expect(parseAmount("15,000.00")).toBe(15000);
    expect(parseAmount("15.000,00")).toBe(15000);
    expect(parseAmount("1 234,56")).toBe(1234.56);
    expect(parseAmount("378711")).toBeNull();
    expect(parseAmount("01")).toBeNull();
  });
  it("datat dd/mm/yy dhe dd.mm.yyyy", () => {
    expect(parseDate("20/10/26")).toBe("2026-10-20");
    expect(parseDate("07.10.2026")).toBe("2026-10-07");
    expect(parseDate("G48837")).toBeNull();
  });
});

describe("parseStatement (NXJERRJE LLOGARIE)", () => {
  const st = parseStatement(itemsToLines(items));
  it("balancat dhe kontrolli i plotësisë", () => {
    expect(st.openingBalance).toBe(349500);
    expect(st.closingBalance).toBe(384500);
    expect(st.balanced).toBe(true);
    expect(st.accountHolder).toBe("TEST PF");
  });
  it("2 hyrje me datë, shumë, përshkrim dhe referencë", () => {
    expect(st.transactions).toHaveLength(2);
    expect(st.transactions[0]).toMatchObject({ date: "2026-10-20", amount: 15000, direction: "in", balance: 364500, reference: "2629302033563000" });
    expect(st.transactions[0].description).toContain("TEMA AL SHPK");
    expect(st.transactions[0].description).toContain("324/2026");
    expect(st.transactions[1].description).toContain("MOBILERI TURI SHPK");
    expect(st.transactions[1].description).toContain("314/2026");
  });
});

describe("matchTransactions", () => {
  const open: OpenInvoice[] = [
    { id: "t324", direction: "sale", number: "324", issue_date: "2026-10-12", outstanding: 15000, counterparty_name: "TEMA AL" },
    { id: "m314", direction: "sale", number: "314", issue_date: "2026-10-07", outstanding: 20000, counterparty_name: "MOBILERI TURI" },
    { id: "m285", direction: "sale", number: "285", issue_date: "2026-09-03", outstanding: 20000, counterparty_name: "MOBILERI TURI" },
    { id: "p1", direction: "purchase", number: "18540", issue_date: "2026-09-03", outstanding: 9600, counterparty_name: "Embedded Systems Design and Production" },
  ];

  it("ekstrakti real: të dyja përputhen me besueshmëri të lartë", () => {
    const st = parseStatement(itemsToLines(items));
    const m = matchTransactions(st.transactions, open);
    expect(m.map((x) => [x.invoices.map((i) => i.id), x.confidence])).toEqual([
      [["t324"], "high"],
      [["m314"], "high"],
    ]);
  });

  const tx = (o: Partial<BankTx>): BankTx => ({ date: "2026-10-20", amount: 0, direction: "in", balance: null, description: "", reference: null, ...o });

  it("pa numër: shuma + emri → zgjidhet fatura më e vjetër e klientit", () => {
    const m = matchTransactions([tx({ amount: 20000, description: "MOBILERI TURI SHPK PAGESE" })], open);
    expect(m[0].invoices.map((i) => i.id)).toEqual(["m285"]);
    expect(m[0].confidence).toBe("medium");
  });

  it("një pagesë për dy fatura", () => {
    const m = matchTransactions([tx({ amount: 40000, description: "MOBILERI TURI FAT 285/2026 DHE 314/2026" })], open);
    expect(m[0].invoices.map((i) => i.id).sort()).toEqual(["m285", "m314"]);
    expect(m[0].confidence).toBe("high");
  });

  it("dalje → fatura blerjeje", () => {
    const m = matchTransactions([tx({ amount: 9600, direction: "out", description: "EMBEDDED SYSTEMS FAT 18540/2026" })], open);
    expect(m[0].invoices.map((i) => i.id)).toEqual(["p1"]);
  });

  it("pagesë e pjesshme sinjalizohet", () => {
    const m = matchTransactions([tx({ amount: 5000, description: "TEMA AL 324/2026" })], open);
    expect(m[0]).toMatchObject({ amountMismatch: true, confidence: "medium" });
  });

  it("e njëjta faturë nuk caktohet dy herë", () => {
    const m = matchTransactions([tx({ amount: 15000, description: "TEMA 324/2026" }), tx({ amount: 15000, description: "TEMA AL" })], open);
    expect(m[0].invoices.map((i) => i.id)).toEqual(["t324"]);
    expect(m[1].invoices).toEqual([]);
  });

  it("datat me pikë nuk merren si numër fature", () => {
    expect(invoiceRefs("FAT 314/2026 DT 07.10.2026")).toEqual([{ num: "314", year: 2026 }]);
  });
});
