"use client";

/**
 * Ruajtja e certifikatës në këtë shfletues (IndexedDB), sipas NIPT-it.
 * Ruhet vetëm CryptoKey i pa-eksportueshëm dhe certifikata publike: as skedari .p12, as fjalëkalimi.
 * Me "mos e ruaj", çelësi mbahet vetëm në kujtesë deri në mbylljen e skedës.
 */
import type { CertificateInfo } from "./cert";

export type StoredCertificate = { nipt: string; info: CertificateInfo; key: CryptoKey; savedAt: string; persisted: boolean };

const DB = "tufa-cis";
const STORE = "certificates";
const memory = new Map<string, StoredCertificate>();

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "nipt" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const r = run(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }).finally(() => db.close());
}

export async function loadCertificate(nipt: string): Promise<StoredCertificate | null> {
  const key = nipt.toUpperCase();
  if (memory.has(key)) return memory.get(key)!;
  try {
    const stored = (await tx("readonly", (s) => s.get(key))) as StoredCertificate | undefined;
    return stored ?? null;
  } catch {
    return null;
  }
}

export async function saveCertificate(cert: StoredCertificate): Promise<void> {
  const key = cert.nipt.toUpperCase();
  memory.set(key, cert);
  if (!cert.persisted) return;
  try {
    await tx("readwrite", (s) => s.put({ ...cert, nipt: key }));
  } catch {
    /* shfletim privat: mbetet vetëm në kujtesë */
  }
}

export async function removeCertificate(nipt: string): Promise<void> {
  const key = nipt.toUpperCase();
  memory.delete(key);
  try {
    await tx("readwrite", (s) => s.delete(key));
  } catch {
    /* asgjë për të fshirë */
  }
}
