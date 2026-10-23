/**
 * Leximi i certifikatës së fiskalizimit (.p12/.pfx) në shfletues, si `cis_client/certificate.py`.
 * Çelësi privat kthehet në CryptoKey të pa-eksportueshëm; materiali i papërpunuar nuk ruhet askund.
 */
import forge from "node-forge";

const NIPT = /(?<![A-Za-z0-9])([A-Za-z]\d{8}[A-Za-z])(?![A-Za-z0-9])/;
// NAIS e vendos NIPT-in te SN (2.5.4.4); pastaj kontrollohen fushat e tjera, me këtë radhë.
const NIPT_OIDS = ["2.5.4.4", "2.5.4.5", "2.5.4.97", "2.5.4.3", "2.5.4.11", "2.5.4.10"];

export type CertificateInfo = {
  nipt: string | null;
  name: string | null;
  commonName: string | null;
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  expired: boolean;
  environment: "production" | "test";
  fingerprintSha256: string;
  certificateB64: string;
};

export class CertificateError extends Error {}

function attr(attrs: forge.pki.CertificateField[], oid: string): string | null {
  const a = attrs.find((x) => x.type === oid);
  return a ? String(a.value) : null;
}

function describe(cert: forge.pki.Certificate): CertificateInfo {
  const subject = cert.subject.attributes;
  let nipt: string | null = null;
  for (const oid of NIPT_OIDS) {
    const m = NIPT.exec(attr(subject, oid) ?? "");
    if (m) {
      nipt = m[1].toUpperCase();
      break;
    }
  }
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const md = forge.md.sha256.create();
  md.update(der);
  const title = attr(subject, "2.5.4.12") ?? "";
  const issuer = attr(cert.issuer.attributes, "2.5.4.3") ?? cert.issuer.attributes.map((a) => `${a.shortName ?? a.type}=${a.value}`).join(", ");
  return {
    nipt,
    name: attr(subject, "2.5.4.10") ?? attr(subject, "2.5.4.3"),
    commonName: attr(subject, "2.5.4.3"),
    issuer,
    serialNumber: cert.serialNumber.toUpperCase(),
    validFrom: cert.validity.notBefore.toISOString(),
    validTo: cert.validity.notAfter.toISOString(),
    expired: Date.now() > cert.validity.notAfter.getTime(),
    environment: /test/i.test(`${title} ${issuer}`) ? "test" : "production",
    fingerprintSha256: md.digest().toHex().toUpperCase(),
    certificateB64: forge.util.encode64(der),
  };
}

const sameKey = (key: forge.pki.rsa.PrivateKey, cert: forge.pki.Certificate) => {
  const pub = cert.publicKey as forge.pki.rsa.PublicKey;
  return !!pub?.n && pub.n.equals(key.n) && pub.e.equals(key.e);
};

/** Hap .p12 me fjalëkalimin; kthen të dhënat e certifikatës dhe çelësin PKCS#8 (vetëm për importKey). */
export function openPkcs12(data: ArrayBuffer, password: string): { info: CertificateInfo; pkcs8: Uint8Array } {
  const bytes = forge.util.binary.raw.encode(new Uint8Array(data));
  let asn1: forge.asn1.Asn1;
  try {
    // NAIS i lëshon skedarët në BER (jo DER të rreptë): leximi jo-strikt i pranon.
    asn1 = forge.asn1.fromDer(bytes, { strict: false, parseAllBytes: false, decodeBitStrings: false } as never);
  } catch {
    throw new CertificateError("Skedari nuk është certifikatë .p12/.pfx.");
  }
  let p12: forge.pkcs12.Pkcs12Pfx | null = null;
  for (const candidate of password ? [password] : ["", undefined]) {
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, candidate as string);
      break;
    } catch {
      /* provo tjetrin */
    }
  }
  if (!p12) throw new CertificateError(password ? "Fjalëkalimi është i gabuar ose skedari nuk është .p12/.pfx." : "Certifikata ka fjalëkalim. Shkruaje.");

  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
  ];
  const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? []).map((b) => b.cert).filter(Boolean) as forge.pki.Certificate[];
  const key = keyBags.map((b) => b.key).find(Boolean) as forge.pki.rsa.PrivateKey | undefined;
  if (!key || certs.length === 0) throw new CertificateError("Skedari nuk ka edhe certifikatën edhe çelësin privat.");
  if (!("n" in key)) throw new CertificateError("CIS kërkon çelës RSA; kjo certifikatë përdor një lloj tjetër.");
  const cert = certs.find((c) => sameKey(key, c));
  if (!cert) throw new CertificateError("Çelësi privat nuk i përket certifikatës.");
  const pkcs8Der = forge.asn1.toDer(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(key))).getBytes();
  return { info: describe(cert), pkcs8: forge.util.binary.raw.decode(pkcs8Der) };
}

/** Çelësi për nënshkrim: i pa-eksportueshëm (as JavaScript-i i faqes nuk mund ta lexojë më). */
export async function importSigningKey(pkcs8: Uint8Array): Promise<CryptoKey> {
  const key = await crypto.subtle.importKey("pkcs8", pkcs8 as BufferSource, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  pkcs8.fill(0);
  return key;
}

export const signWith = (key: CryptoKey) => (data: Uint8Array) => crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data as BufferSource);
