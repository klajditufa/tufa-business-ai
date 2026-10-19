import { describe, expect, it } from "vitest";
import { money, date, monthRange } from "../format";

describe("format", () => {
  it("formaton LEK me ndarës shqiptarë", () => {
    expect(money("1234567.89")).toMatch(/1.234.567,89 LEK/);
    expect(money(0, "ALL", 0)).toBe("0 LEK");
    expect(money("12.5", "EUR")).toMatch(/12,50 EUR/);
  });
  it("kthen — për vlera të munguara", () => {
    expect(money(null)).toBe("—");
    expect(money("abc")).toBe("—");
  });
  it("formaton datën dd.mm.yyyy", () => {
    expect(date("2026-10-19")).toBe("19.10.2026");
  });
  it("monthRange mbulon gjithë muajin", () => {
    const r = monthRange(new Date(2026, 1, 15));
    expect(r.from).toBe("2026-02-01");
    expect(r.to).toBe("2026-02-28");
  });
});
