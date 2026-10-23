import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDetails, fetchInvoices, type CisSession } from "../cis/client";
import { importSigningKey, openPkcs12, signWith } from "../cis/cert";

// CIS i rremë mbi fetch: >10 ditë → gabimi 87; 3 fatura në ditë; kërkesa sipas FIC kthen artikujt.
const SOAP = 'xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"';
const NS = "https://eFiskalizimi.tatime.gov.al/FiscalizationDataService/schema";
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;
const calls: { from?: string; to?: string; fic?: string }[] = [];

function fakeCis(body: string) {
  const { envelope } = JSON.parse(body) as { envelope: string };
  const uuid = /UUID="([^"]+)"/.exec(envelope)![1];
  const attr = (n: string) => new RegExp(` ${n}="([^"]+)"`).exec(envelope)?.[1];
  const fic = attr("FIC");
  const from = attr("FromDate")?.slice(0, 10);
  const to = attr("ToDate")?.slice(0, 10);
  calls.push({ from, to, fic });
  const wrap = (inner: string) =>
    `<?xml version='1.0' encoding='UTF-8'?><S:Envelope ${SOAP}><S:Body><ns2:GetInvoicesResponse xmlns:ns2="${NS}" Id="Response"><ns2:Header RequestUUID="${uuid}"/>${inner}</ns2:GetInvoicesResponse></S:Body></S:Envelope>`;
  if (fic) return wrap(`<ns2:Invoices count="1"><ns2:Inv FIC="${fic}" TotPrice="120"><ns2:Items><ns2:I N="Kafe" Q="1" PA="120"/></ns2:Items></ns2:Inv></ns2:Invoices>`);
  if (days(from!, to!) > 10)
    return `<S:Envelope ${SOAP}><S:Body><S:Fault><faultcode>S:CLIENT</faultcode><faultstring>Excessive Code=87 RequestUUID=${uuid}</faultstring><detail><code>87</code></detail></S:Fault></S:Body></S:Envelope>`;
  const invs: string[] = [];
  for (let d = Date.parse(from!); d <= Date.parse(to!); d += 86400000) {
    const day = new Date(d).toISOString().slice(0, 10);
    for (let i = 0; i < 3; i++) invs.push(`<ns2:Inv FIC="${day}-${i}" IssueDateTime="${day}T10:00:00+02:00" TotPrice="120"/>`);
  }
  return wrap(`<ns2:Invoices count="${invs.length}">${invs.join("")}</ns2:Invoices>`);
}

async function session(): Promise<CisSession> {
  const p12 = readFileSync(join(__dirname, "cis", "selfsigned-test-only.p12"));
  const { info, pkcs8 } = openPkcs12(p12.buffer.slice(p12.byteOffset, p12.byteOffset + p12.byteLength), "test");
  return { companyId: "c1", environment: "test", signer: { sign: signWith(await importSigningKey(pkcs8)), certificateB64: info.certificateB64 } };
}

afterEach(() => {
  vi.unstubAllGlobals();
  calls.length = 0;
});

describe("klienti CIS në shfletues", () => {
  it("periudha e gjatë ndahet pas gabimit 87, pa dyfishime", async () => {
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => new Response(fakeCis(String(init.body)), { headers: { "X-CIS-Status": "200" } }));
    const invoices = await fetchInvoices(await session(), "SALES", "2026-01-01", "2026-01-31");
    expect(invoices).toHaveLength(31 * 3);
    expect(new Set(invoices.map((i) => i.FIC)).size).toBe(93);
    expect(calls.some((c) => c.from === "2026-01-01" && c.to === "2026-01-31")).toBe(true);
  });

  it("artikujt merren sipas FIC", async () => {
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => new Response(fakeCis(String(init.body)), { headers: { "X-CIS-Status": "200" } }));
    const s = await session();
    const list = await fetchInvoices(s, "SALES", "2026-01-01", "2026-01-02");
    const { invoices, failed } = await fetchDetails(s, "SALES", list);
    expect(failed).toBe(0);
    expect(invoices.every((i) => i.Items?.[0]?.N === "Kafe")).toBe(true);
  });

  it("gabimi i TUFA (pa X-CIS-Status) del me mesazhin e serverit", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: false, error: "Certifikata nuk është e subjektit X" }), { status: 400 }));
    await expect(fetchInvoices(await session(), "SALES", "2026-01-01", "2026-01-01")).rejects.toThrow(/nuk është e subjektit/);
  });
});
