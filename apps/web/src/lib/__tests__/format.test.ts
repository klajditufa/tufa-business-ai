import { describe, expect, it } from "vitest";
import { amount, money, date, monthLabel, monthRange } from "../format";

describe("format", () => {
  it("formaton shumat si cis-client-2 (1,234,567.89), njësoj në server dhe shfletues", () => {
    expect(money("1234567.89")).toBe("1,234,567.89 LEK");
    expect(money(0, "ALL", 0)).toBe("0 LEK");
    expect(money("12.5", "EUR")).toBe("12.50 EUR");
    expect(money(-1500.5)).toBe("-1,500.50 LEK");
    expect(money(-0.001)).toBe("0.00 LEK");
    expect(amount(11550)).toBe("11,550.00");
  });
  it("kthen — për vlera të munguara", () => {
    expect(money(null)).toBe("—");
    expect(money("abc")).toBe("—");
  });
  it("formaton datën dd/mm/vvvv pa zhvendosje zone", () => {
    expect(date("2026-10-19")).toBe("19/10/2026");
    expect(date(new Date(2026, 0, 5))).toBe("05/01/2026");
    expect(monthLabel("2026-10-01")).toBe("Tet 26");
  });
  it("monthRange mbulon gjithë muajin", () => {
    const r = monthRange(new Date(2026, 1, 15));
    expect(r.from).toBe("2026-02-01");
    expect(r.to).toBe("2026-02-28");
  });
});
