/**
 * Mesazhet e nënshkruara për CIS, të ndërtuara direkt në formën kanonike (exclusive C14N).
 *
 * Përshtatur nga cis-client (`cis_client/xmlsig.py`, `transport.py`, docs/PROTOCOL.md):
 *  - elementi i kërkesës (Id="Request") shkruhet që në fillim në formën kanonike: atributet e renditura,
 *    elementet bosh si <A></A>, karakteret e veçanta të koduara — kështu kanonizimi është vetë teksti;
 *  - DigestValue = SHA-256 i kërkesës pa Signature (= transformimi enveloped-signature);
 *  - SignatureValue = RSASSA-PKCS1-v1_5 / SHA-256 mbi SignedInfo kanonik, me çelësin në shfletues
 *    (CryptoKey i pa-eksportueshëm). Çelësi privat nuk largohet kurrë nga kompjuteri i përdoruesit.
 */

export const DS_NS = "http://www.w3.org/2000/09/xmldsig#";
const EXC_C14N = "http://www.w3.org/2001/10/xml-exc-c14n#";
const ENVELOPED = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";
const RSA_SHA256 = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
const SHA256 = "http://www.w3.org/2001/04/xmlenc#sha256";

export type CisService = "data" | "fiscalization" | "einvoice";
export type CisEnvironment = "production" | "test";

export const SERVICES: Record<CisService, { prefix: string; url: Record<CisEnvironment, string> }> = {
  data: {
    prefix: "https://eFiskalizimi.tatime.gov.al/FiscalizationDataService",
    url: {
      production: "https://efiskalizimi.tatime.gov.al/FiscalizationDataService-v1",
      test: "https://efiskalizimi-test.tatime.gov.al/FiscalizationDataService-v1",
    },
  },
  fiscalization: {
    prefix: "https://eFiskalizimi.tatime.gov.al/FiscalizationService",
    url: {
      production: "https://efiskalizimi.tatime.gov.al/FiscalizationService-v3",
      test: "https://efiskalizimi-test.tatime.gov.al/FiscalizationService-v3",
    },
  },
  einvoice: {
    prefix: "https://Einvoice.tatime.gov.al/EinvoiceService",
    url: {
      production: "https://einvoice.tatime.gov.al/EinvoiceService-v1",
      test: "https://einvoice-test.tatime.gov.al/EinvoiceService-v1",
    },
  },
};

/** Operacionet e lejuara (vetëm lexim). */
export const OPERATIONS = {
  GetInvoices: { service: "data", version: "3" },
  GetOperators: { service: "fiscalization", version: "3" },
  GetBusinessUnits: { service: "fiscalization", version: "3" },
  GetTCRs: { service: "fiscalization", version: "3" },
  GetTaxpayers: { service: "einvoice", version: "1" },
  GetEinvoices: { service: "einvoice", version: "1" },
} as const satisfies Record<string, { service: CisService; version: string }>;
export type CisOperation = keyof typeof OPERATIONS;

export type XmlNode = { name: string; attrs?: Record<string, string | undefined>; children?: (XmlNode | string)[] };

const escAttr = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;").replace(/\t/g, "&#x9;").replace(/\n/g, "&#xA;").replace(/\r/g, "&#xD;");
const escText = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r/g, "&#xD;");

/** Element në formën kanonike: atributet pa prefiks renditen sipas emrit; elementet bosh me tag mbyllës. */
export function canonical(node: XmlNode, xmlns?: string): string {
  const attrs = Object.entries(node.attrs ?? {})
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => ` ${k}="${escAttr(v)}"`)
    .join("");
  const ns = xmlns ? ` xmlns="${escAttr(xmlns)}"` : "";
  const inner = (node.children ?? []).map((c) => (typeof c === "string" ? escText(c) : canonical(c))).join("");
  return `<${node.name}${ns}${attrs}>${inner}</${node.name}>`;
}

/** Koha si VVVV-MM-DDThh:mm:ss+hh:mm, pa pjesë sekondash, në zonën Europe/Tirane. */
export function cisDateTime(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Tirane",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZoneName: "longOffset",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const offset = (parts.timeZoneName as string).replace("GMT", "") || "+00:00";
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}

const b64 = (bytes: ArrayBuffer | Uint8Array) => {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i += 0x8000) s += String.fromCharCode(...arr.subarray(i, i + 0x8000));
  return btoa(s);
};

export type Signer = {
  /** RSASSA-PKCS1-v1_5 / SHA-256 */
  sign: (data: Uint8Array) => Promise<ArrayBuffer>;
  /** Certifikata X.509 (DER, base64) */
  certificateB64: string;
};

export type BuiltRequest = { operation: CisOperation; uuid: string; soapAction: string; envelope: string; canonicalRequest: string; signedInfo: string };

/** Ndërton dhe nënshkruan një kërkesë CIS; `body` janë elementet pas Header-it. */
export async function buildSignedRequest(
  operation: CisOperation,
  body: XmlNode[],
  signer: Signer,
  options: { uuid?: string; now?: Date } = {},
): Promise<BuiltRequest> {
  const op = OPERATIONS[operation];
  const prefix = SERVICES[op.service].prefix;
  const uuid = options.uuid ?? crypto.randomUUID();
  const request: XmlNode = {
    name: `${operation}Request`,
    attrs: { Id: "Request", Version: op.version },
    children: [{ name: "Header", attrs: { UUID: uuid, SendDateTime: cisDateTime(options.now ?? new Date()) } }, ...body],
  };
  const canonicalRequest = canonical(request, `${prefix}/schema`);
  const enc = new TextEncoder();
  const digest = b64(await crypto.subtle.digest("SHA-256", enc.encode(canonicalRequest)));
  const signedInfoInner =
    `<CanonicalizationMethod Algorithm="${EXC_C14N}"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="${RSA_SHA256}"></SignatureMethod>` +
    `<Reference URI="#Request"><Transforms><Transform Algorithm="${ENVELOPED}"></Transform>` +
    `<Transform Algorithm="${EXC_C14N}"></Transform></Transforms>` +
    `<DigestMethod Algorithm="${SHA256}"></DigestMethod><DigestValue>${digest}</DigestValue></Reference>`;
  // Kanonizuar në vend, SignedInfo merr deklaratën e hapësirës së emrave nga Signature.
  const signedInfo = `<SignedInfo xmlns="${DS_NS}">${signedInfoInner}</SignedInfo>`;
  const signatureValue = b64(await signer.sign(enc.encode(signedInfo)));
  const signature =
    `<Signature xmlns="${DS_NS}"><SignedInfo>${signedInfoInner}</SignedInfo>` +
    `<SignatureValue>${signatureValue}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${signer.certificateB64}</X509Certificate></X509Data></KeyInfo></Signature>`;
  const closing = `</${operation}Request>`;
  const signedRequest = canonicalRequest.slice(0, -closing.length) + signature + closing;
  const envelope =
    `<?xml version='1.0' encoding='UTF-8'?>\n` +
    `<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Header/><SOAP-ENV:Body>` +
    `${signedRequest}</SOAP-ENV:Body></SOAP-ENV:Envelope>`;
  return { operation, uuid, soapAction: `${prefix}/${operation}`, envelope, canonicalRequest, signedInfo };
}

/** Trupat e kërkesave që përdor TUFA. */
export const bodies = {
  invoicesByPeriod: (kind: "SALES" | "PURCHASES", from: string, to: string, page: number): XmlNode[] => [
    { name: "InvoicesRequestBody", attrs: { FromDate: from, ToDate: to, InvTransactionType: kind, Page: String(page) } },
  ],
  invoiceByFic: (kind: "SALES" | "PURCHASES", fic: string): XmlNode[] => [{ name: "InvoicesRequestBody", attrs: { FIC: fic, InvTransactionType: kind } }],
  taxpayer: (term: string): XmlNode[] => [
    { name: "Filter", children: [{ name: /^[A-Za-z]\d{8}[A-Za-z]$/.test(term) ? "Tin" : "Name", children: [/^[A-Za-z]\d{8}[A-Za-z]$/.test(term) ? term.toUpperCase() : term] }] },
  ],
  none: (): XmlNode[] => [],
  einvoicePdf: (eic: string, partyType: "BUYER" | "SELLER"): XmlNode[] => [
    { name: "EIC", children: [eic] },
    { name: "PartyType", children: [partyType] },
  ],
};
