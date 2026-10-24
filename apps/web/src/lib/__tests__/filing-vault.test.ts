import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import * as vault from "../filing/vault";

const NIPT = "X99999999X";

describe("kasaforta e e-Albania (si FilingVault i cis-client-2)", () => {
  it("NUIS duhet të jetë NIPT-i i subjektit", () => {
    expect(vault.validCredentials(NIPT, { username: "x99999999x", password: "p" })).toBeNull();
    expect(vault.validCredentials(NIPT, { username: "K11111111A", password: "p" })).toMatch(/NIPT-i i këtij subjekti/);
    expect(vault.validCredentials(NIPT, { username: "abc", password: "p" })).toMatch(/K12345678L/);
    expect(vault.validCredentials(NIPT, { username: NIPT, password: "" })).toMatch(/fjalëkalimin/);
  });

  it("ruan vetëm të enkriptuara dhe hapet vetëm me fjalëkalimin e kasafortës", async () => {
    await expect(vault.remember(NIPT, { username: NIPT, password: "sekret-portali" }, "shkurt")).rejects.toThrow(/12/);
    await vault.remember(NIPT, { username: NIPT, password: "sekret-portali" }, "kasaforta-e-gjate-1");
    expect(await vault.isRemembered(NIPT)).toBe(true);
    // Asgjë e lexueshme në IndexedDB
    const raw = await vault.__rawEntryForTests(NIPT);
    expect(JSON.stringify(raw)).not.toContain("sekret-portali");
    await expect(vault.unlock(NIPT, "kasaforta-e-gabuar")).rejects.toThrow(/gabuar/);
    expect(await vault.unlock(NIPT, "kasaforta-e-gjate-1")).toEqual({ username: NIPT, password: "sekret-portali" });
    vault.useForSession(NIPT, { username: NIPT, password: "sekret-portali" });
    await vault.forget(NIPT);
    expect(await vault.isRemembered(NIPT)).toBe(false);
    expect(vault.sessionCredentials(NIPT)).toBeNull();
  }, 30000);
});
