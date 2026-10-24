"use client";

/**
 * Ngarkimi i certifikatës në shfletues (si POST /api/session i cis-client-2):
 * hapet .p12, kontrollohet NIPT-i dhe afati, çelësi importohet si i pa-eksportueshëm dhe CIS e konfirmon me GetTCRs.
 */
import { CertificateError, importSigningKey, openPkcs12, signWith, type CertificateInfo } from "./cert";
import { registry } from "./client";
import { saveCertificate, type StoredCertificate } from "./store";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";

export type OpenedCertificate = { info: CertificateInfo; pkcs8: Uint8Array };

export async function openCertificate(file: File, password: string): Promise<OpenedCertificate> {
  const opened = openPkcs12(await file.arrayBuffer(), password);
  if (!opened.info.nipt) throw new CertificateError("Certifikata nuk ka NIPT; CIS nuk e pranon.");
  if (opened.info.expired) {
    throw new CertificateError(`Certifikata ka skaduar më ${opened.info.validTo.slice(0, 10).split("-").reverse().join(".")}.`);
  }
  return opened;
}

export async function attachCertificate(
  company: { id: string; nipt: string },
  { info, pkcs8 }: OpenedCertificate,
  environment: "production" | "test" | null,
  keep: boolean,
): Promise<StoredCertificate> {
  if (info.nipt !== company.nipt.toUpperCase()) {
    throw new CertificateError(`Kjo certifikatë është për NIPT ${info.nipt}, jo për ${company.nipt}. Zgjidhni subjektin e duhur.`);
  }
  const key = await importSigningKey(pkcs8);
  const env = environment ?? info.environment;
  const stored: StoredCertificate = { nipt: info.nipt, info: { ...info, environment: env }, key, savedAt: new Date().toISOString(), persisted: keep };
  const tcrs = await registry.tcrs({ companyId: company.id, environment: env, signer: { sign: signWith(key), certificateB64: info.certificateB64 } });
  await createClient().rpc("set_company_registry", { p_company_id: company.id, p_kind: "tcrs", p_rows: tcrs as unknown as Json });
  await saveCertificate(stored);
  return stored;
}
