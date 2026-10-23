import { describe, expect, it } from "vitest";
import { cents, itemsOf, summariseItems } from "../invoice-items";

describe("artikujt e faturave", () => {
  it("cents pa float", () => {
    expect(cents("0.1")).toBe(10);
    expect(cents("123.455")).toBe(12346);
    expect(cents("-20.00")).toBe(-2000);
    expect(cents("abc")).toBe(0);
  });

  it("grupon sipas emrit (pa theksa/shkronja të mëdha) dhe njësisë; korrigjueset zbresin", () => {
    const s = summariseItems([
      { id: "a", items: [{ N: "Kafe Ekspres", C: "K1", U: "copë", Q: "2", PB: "100.00", VA: "20.00", PA: "120.00" }] },
      { id: "b", items: [{ N: "kafe ekspres ", C: "k1", U: "C", Q: "1", PB: "50.00", VA: "10.00", PA: "60.00" }, { N: "Ujë", U: "L", Q: "3", PB: "90.00", VA: "18.00", PA: "108.00" }] },
      { id: "c", items: [{ N: "KAFE EKSPRES", C: "X9", U: "cope", Q: "-1", PB: "-50.00", VA: "-10.00", PA: "-60.00" }] },
    ]);
    expect(s.map((r) => [r.name, r.unit, r.quantity, r.total, r.invoices, r.codes])).toEqual([
      ["Kafe Ekspres", "copë", 2, 12000, 3, ["K1", "X9"]],
      ["Ujë", "litër", 3, 10800, 1, []],
    ]);
  });

  it("itemsOf dallon faturën pa detaje", () => {
    expect(itemsOf({ FIC: "x" })).toBeNull();
    expect(itemsOf({ Items: [{ N: "a" }, null] })).toEqual([{ N: "a" }]);
  });
});
