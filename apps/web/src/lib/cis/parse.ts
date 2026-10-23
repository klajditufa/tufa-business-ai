/**
 * Leximi i përgjigjeve të CIS (si `cis_client/convert.py` + `transport.py`), pa varësi nga DOM-i,
 * që të punojë njësoj në shfletues, në server dhe në teste.
 *
 *  - elementet lexohen sipas emrit lokal (prefikset ndryshojnë sipas shërbimit);
 *  - DTD/entitetet e jashtme refuzohen;
 *  - çdo vlerë mbetet string siç e dërgoi CIS ("120.00", "true").
 */

export type XmlEl = { name: string; attrs: Record<string, string>; children: XmlEl[]; text: string };

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, (_, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e],
  );
const local = (qname: string) => qname.slice(qname.indexOf(":") + 1);

export class CisXmlError extends Error {}

/** Parser i vogël XML për përgjigjet SOAP (pa DTD, pa CDATA të nevojshme). */
export function parseXml(xml: string): XmlEl {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new CisXmlError("Përgjigje XML me DTD u refuzua");
  const root: XmlEl = { name: "#root", attrs: {}, children: [], text: "" };
  const stack: XmlEl[] = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  const attrRe = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2]) {
      if (stack.length < 2 || top.name !== local(m[2])) throw new CisXmlError("XML i pavlefshëm nga CIS");
      stack.pop();
    } else if (m[3]) {
      const attrs: Record<string, string> = {};
      let a: RegExpExecArray | null;
      while ((a = attrRe.exec(m[4] ?? ""))) {
        if (a[1] === "xmlns" || a[1].startsWith("xmlns:")) continue;
        attrs[local(a[1])] = decode(a[2] ?? a[3] ?? "");
      }
      const el: XmlEl = { name: local(m[3]), attrs, children: [], text: "" };
      top.children.push(el);
      if (!m[5]) stack.push(el);
    } else if (m[6] !== undefined && m[0][0] !== "<") top.text += decode(m[6]);
  }
  if (stack.length !== 1) throw new CisXmlError("XML i paplotë nga CIS");
  return root;
}

export const child = (el: XmlEl | undefined, name: string) => el?.children.find((c) => c.name === name);

export class CisFault extends Error {
  constructor(
    readonly faultCode: string,
    readonly code: string | null,
    message: string,
  ) {
    super(message);
  }
  get temporary() {
    return /server/i.test(this.faultCode);
  }
}

/** Mesazhe shqip për gabimet e zakonshme të CIS (si HINTS_SQ i cis-client). */
export const FAULT_HINTS: Record<string, string> = {
  "2": "Ora e kompjuterit ndryshon shumë nga ajo e CIS. Rregullo orën dhe provo sërish.",
  "34": "Certifikata nuk pranohet në këtë mjedis (p.sh. certifikatë testi në prodhim) ose nuk ka NIPT.",
  "35": "Certifikata nuk është lëshuar nga AKSHI/NAIS për këtë mjedis.",
  "36": "Certifikata ka skaduar. Kërko një të re te AKSHI.",
  "38": "Certifikata është revokuar.",
  "52": "Subjekti nuk gjendet në regjistrin e tatimpaguesve.",
  "55": "Subjekti nuk është aktiv.",
  "87": "Periudha është shumë e gjatë; ndahet automatikisht.",
};

/** Kthen elementin {Operation}Response ose hedh CisFault; kontrollon RequestUUID. */
export function responseBody(xml: string, operation: string, requestUuid: string): XmlEl {
  const doc = parseXml(xml);
  const envelope = doc.children.find((c) => c.name === "Envelope");
  const body = child(envelope, "Body");
  if (!body) throw new CisXmlError("CIS ktheu një përgjigje të panjohur");
  const fault = child(body, "Fault");
  if (fault) {
    const faultString = (child(fault, "faultstring")?.text ?? "").trim();
    const code = (child(child(fault, "detail"), "code")?.text ?? "").trim() || /Code=(\d+)/.exec(faultString)?.[1] || null;
    const clean = faultString.replace(/\s*Code=\S+[\s\S]*$/, "").trim();
    throw new CisFault((child(fault, "faultcode")?.text ?? "").trim(), code, clean || "CIS refuzoi kërkesën");
  }
  const response = child(body, `${operation}Response`);
  if (!response) throw new CisXmlError(`Përgjigjja nuk ka ${operation}Response`);
  const echoed = (child(response, "Header")?.attrs.RequestUUID ?? "").toLowerCase();
  if (echoed !== requestUuid.toLowerCase()) throw new CisXmlError("Përgjigjja e CIS nuk i përket kësaj kërkese");
  return response;
}

const LIST_CONTAINERS: Record<string, string> = {
  PayMethods: "PayMethod",
  Vouchers: "Voucher",
  SameTaxes: "SameTax",
  Fees: "Fee",
  SumInvIICRefs: "SumInvIICRef",
  Items: "I",
  VN: "V",
};

export type CisInvoice = Record<string, unknown> & { FIC?: string; Items?: Record<string, string>[] };

function toDict(el: XmlEl): Record<string, unknown> {
  const out: Record<string, unknown> = { ...el.attrs };
  for (const c of el.children) {
    const item = LIST_CONTAINERS[c.name];
    out[c.name] = item ? c.children.filter((x) => x.name === item).map(toDict) : toDict(c);
  }
  return out;
}

export function invoicesFrom(response: XmlEl): { invoices: CisInvoice[]; count: number } {
  const container = child(response, "Invoices");
  if (!container) return { invoices: [], count: 0 };
  const invoices = container.children
    .filter((c) => c.name === "Inv")
    .map((c) => {
      const d = toDict(c) as CisInvoice;
      if (Array.isArray(d.Items) && d.Items.length === 0) delete d.Items;
      return d;
    });
  const count = Number.parseInt(container.attrs.count ?? "", 10);
  return { invoices, count: Math.max(Number.isFinite(count) ? count : invoices.length, invoices.length) };
}

export function operatorsFrom(response: XmlEl) {
  return (child(response, "Operators")?.children ?? [])
    .filter((c) => c.name === "Operator")
    .map((c) => {
      const first = c.attrs.OprFirstName ?? "";
      const last = c.attrs.OprLastName ?? "";
      return {
        name: [first, last].filter(Boolean).join(" "),
        opCode: c.attrs.OprCode ?? "",
        idNumber: c.attrs.OprID ?? "",
        validFrom: c.attrs.OprValidFrom ?? null,
        validTo: c.attrs.OprValidTo ?? null,
      };
    });
}

export function listFrom(response: XmlEl, container: string, item: string): Record<string, string>[] {
  return (child(response, container)?.children ?? []).filter((c) => c.name === item).map((c) => ({ ...c.attrs }));
}
