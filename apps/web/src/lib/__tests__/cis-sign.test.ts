import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bodies, buildSignedRequest, canonical, cisDateTime } from "../cis/sign";
import { importSigningKey, openPkcs12, signWith } from "../cis/cert";

// Vektorët e testit nga cis-client (docs/PROTOCOL.md §4): certifikata vetë-nënshkruar e provës, fjalëkalimi "test".
const dir = join(__dirname, "cis");
const read = (f: string) => readFileSync(join(dir, f), "utf8");
const p12 = readFileSync(join(dir, "selfsigned-test-only.p12"));

async function signer() {
  const { info, pkcs8 } = openPkcs12(p12.buffer.slice(p12.byteOffset, p12.byteOffset + p12.byteLength), "test");
  return { info, signer: { sign: signWith(await importSigningKey(pkcs8)), certificateB64: info.certificateB64 } };
}

describe("nënshkrimi i CIS = cis-client", () => {
  it("lexon certifikatën e provës", async () => {
    const { info } = await signer();
    expect(info.nipt).toBe("X99999999X");
    expect(info.environment).toBe("test");
  });

  it("fjalëkalimi i gabuar refuzohet me mesazh shqip", () => {
    expect(() => openPkcs12(p12.buffer.slice(p12.byteOffset, p12.byteOffset + p12.byteLength), "gabim")).toThrow(/Fjalëkalimi/);
  });

  it("kërkesa kanonike, SignedInfo dhe SignatureValue përputhen me vektorët", async () => {
    const { signer: s } = await signer();
    const built = await buildSignedRequest(
      "GetInvoices",
      bodies.invoicesByPeriod("SALES", "2026-09-01T00:00:00+02:00", "2026-09-30T23:59:59+02:00", 1),
      s,
      { uuid: "8f1f5b8e-2c7a-4d4e-9a51-0f3c2b1a7e6d", now: new Date("2026-09-30T08:15:00Z") },
    );
    expect(built.canonicalRequest).toBe(read("GetInvoicesRequest.c14n.xml").trim());
    expect(built.signedInfo).toBe(read("GetInvoicesRequest.SignedInfo.c14n.xml").trim());
    const golden = read("GetInvoicesRequest.signed.xml");
    const value = (x: string, tag: string) => new RegExp(`<${tag}>([^<]+)</${tag}>`).exec(x)?.[1];
    expect(value(built.envelope, "SignatureValue")).toBe(value(golden, "SignatureValue"));
    expect(value(built.envelope, "X509Certificate")).toBe(value(golden, "X509Certificate"));
    expect(built.soapAction).toBe("https://eFiskalizimi.tatime.gov.al/FiscalizationDataService/GetInvoices");
  });

  it("GetOperators pa trup përputhet me vektorin", async () => {
    const { signer: s } = await signer();
    const golden = read("GetOperatorsRequest.signed.xml");
    const uuid = /UUID="([^"]+)"/.exec(golden)![1];
    const sent = /SendDateTime="([^"]+)"/.exec(golden)![1];
    const built = await buildSignedRequest("GetOperators", bodies.none(), s, { uuid, now: new Date(sent) });
    const value = (x: string, tag: string) => new RegExp(`<${tag}>([^<]+)</${tag}>`).exec(x)?.[1];
    expect(value(built.envelope, "DigestValue")).toBe(value(golden, "DigestValue"));
    expect(value(built.envelope, "SignatureValue")).toBe(value(golden, "SignatureValue"));
  });

  it("koha në zonën e Tiranës, pa sekonda të pjesshme", () => {
    expect(cisDateTime(new Date("2026-09-30T08:15:00.789Z"))).toBe("2026-09-30T10:15:00+02:00");
    expect(cisDateTime(new Date("2026-01-15T12:00:00Z"))).toBe("2026-01-15T13:00:00+01:00");
  });

  it("karakteret e veçanta kodohen si në C14N", () => {
    expect(canonical({ name: "A", attrs: { b: 'x"&<\n', a: "1" }, children: ["t&<>"] })).toBe('<A a="1" b="x&quot;&amp;&lt;&#xA;">t&amp;&lt;&gt;</A>');
  });
});
