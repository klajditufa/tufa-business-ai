import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CisFault, invoicesFrom, listFrom, operatorsFrom, parseXml, responseBody } from "../cis/parse";

// Përgjigjet janë prodhuar nga FakeCis i cis-client; `expected.json` është leximi i convert.py për to.
const dir = join(__dirname, "cis");
const read = (f: string) => readFileSync(join(dir, f), "utf8");
const expected = JSON.parse(read("expected.json"));
const uuidOf = (xml: string) => /RequestUUID="([^"]+)"/.exec(xml)![1];

describe("përgjigjet e CIS = convert.py", () => {
  it("lista e faturave", () => {
    const xml = read("resp-invoices.xml");
    const { invoices, count } = invoicesFrom(responseBody(xml, "GetInvoices", uuidOf(xml)));
    expect(count).toBe(expected.count);
    expect(invoices).toEqual(expected.list);
  });

  it("fatura e plotë me artikujt", () => {
    const xml = read("resp-invoice-fic.xml");
    const { invoices } = invoicesFrom(responseBody(xml, "GetInvoices", uuidOf(xml)));
    expect(invoices[0]).toEqual(expected.full);
    expect(invoices[0].Items?.length).toBeGreaterThan(0);
  });

  it("operatorët dhe pajisjet", () => {
    const ops = read("resp-operators.xml");
    const fromPy = expected.operators.map((o: Record<string, unknown>) => ({ name: o.name, opCode: o.opCode, idNumber: o.idNumber, validFrom: o.validFrom, validTo: o.validTo }));
    expect(operatorsFrom(responseBody(ops, "GetOperators", uuidOf(ops)))).toEqual(fromPy);
    const tcrs = read("resp-tcrs.xml");
    expect(listFrom(responseBody(tcrs, "GetTCRs", uuidOf(tcrs)), "TCRs", "TCR")).toEqual(expected.tcrs);
  });

  it("gabimi 87 lexohet me kodin dhe pa bishtin RequestUUID", () => {
    try {
      responseBody(read("resp-fault87.xml"), "GetInvoices", "x");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(CisFault);
      expect((e as CisFault).code).toBe("87");
      expect((e as CisFault).message).toBe("Excessive number of invoices detected! Please restrict the search period.");
    }
  });

  it("përgjigje e një kërkese tjetër refuzohet; DTD refuzohet", () => {
    const xml = read("resp-invoices.xml");
    expect(() => responseBody(xml, "GetInvoices", "tjeter")).toThrow(/nuk i përket/);
    expect(() => parseXml('<!DOCTYPE x [<!ENTITY a "b">]><x>&a;</x>')).toThrow(/DTD/);
  });

  it("entitetet dhe karakteret shqipe", () => {
    const doc = parseXml(`<a n="Ç&amp;Ë &#x41;&#66;"><b>x &lt; y</b></a>`);
    expect(doc.children[0].attrs.n).toBe("Ç&Ë AB");
    expect(doc.children[0].children[0].text).toBe("x < y");
  });
});
