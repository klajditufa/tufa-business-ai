"use client";

/**
 * Të dhënat e e-Albania të subjektit (si FilingVault i cis-client-2), vetëm në këtë shfletues:
 *  - pa "Ruaji": mbahen në kujtesë për sesionin (deri në rifreskimin/mbylljen e faqes);
 *  - me "Ruaji": enkriptohen me "fjalëkalimin e kasafortës" (PBKDF2-SHA256 600k → AES-GCM 256) dhe ruhen
 *    në IndexedDB. Pa fjalëkalimin e kasafortës nuk lexohen dot; ai nuk ruhet askund.
 * Asgjë nga këto nuk dërgohet te serveri i TUFA; fjalëkalimi i jepet vetëm shtesës për një hyrje.
 */
import { idb } from "@/lib/cis/store";

export type FilingCredentials = { username: string; password: string };
type VaultEntry = { id: string; v: 1; salt: string; iv: string; data: string; savedAt: string };

export const NIPT_RE = /^[A-Z]\d{8}[A-Z]$/;
const ITERATIONS = 600_000;
const session = new Map<string, FilingCredentials>();

const b64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function entryId(nipt: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nipt.toUpperCase()));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class VaultError extends Error {}

export function checkPassphrase(passphrase: string) {
  if (passphrase.length < 12 || passphrase.length > 1024) throw new VaultError("Fjalëkalimi i kasafortës duhet të ketë 12–1024 karaktere.");
}

async function cipherKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  checkPassphrase(passphrase);
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Kontrollon NUIS = NIPT i subjektit (si cis-client) dhe fjalëkalimin. */
export function validCredentials(nipt: string, creds: FilingCredentials): string | null {
  const username = creds.username.trim().toUpperCase();
  if (!NIPT_RE.test(username)) return "NUIS / NIPT duhet të jetë si K12345678L.";
  if (username !== nipt.toUpperCase()) return `NUIS i e-Albania duhet të jetë NIPT-i i këtij subjekti (${nipt}).`;
  if (!creds.password) return "Shkruaj fjalëkalimin e e-Albania.";
  if (creds.password.length > 256) return "Fjalëkalimi është shumë i gjatë.";
  return null;
}

export function sessionCredentials(nipt: string): FilingCredentials | null {
  return session.get(nipt.toUpperCase()) ?? null;
}

export function useForSession(nipt: string, creds: FilingCredentials) {
  session.set(nipt.toUpperCase(), { username: creds.username.trim().toUpperCase(), password: creds.password });
}

export async function isRemembered(nipt: string): Promise<boolean> {
  try {
    const id = await entryId(nipt);
    return !!(await idb<VaultEntry | undefined>("filing", "readonly", (s) => s.get(id)));
  } catch {
    return false;
  }
}

export async function remember(nipt: string, creds: FilingCredentials, passphrase: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await cipherKey(passphrase, salt);
  const plain = new TextEncoder().encode(JSON.stringify({ username: creds.username.trim().toUpperCase(), password: creds.password }));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  const entry: VaultEntry = { id: await entryId(nipt), v: 1, salt: b64(salt), iv: b64(iv), data: b64(data), savedAt: new Date().toISOString() };
  try {
    await idb("filing", "readwrite", (s) => s.put(entry));
  } catch {
    throw new VaultError("Shfletuesi nuk lejon ruajtjen (p.sh. dritare private). Të dhënat përdoren vetëm për këtë sesion.");
  }
}

export async function unlock(nipt: string, passphrase: string): Promise<FilingCredentials> {
  const id = await entryId(nipt);
  const entry = await idb<VaultEntry | undefined>("filing", "readonly", (s) => s.get(id));
  if (!entry) throw new VaultError("Nuk ka të dhëna të ruajtura për këtë subjekt.");
  try {
    const key = await cipherKey(passphrase, unb64(entry.salt));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(entry.iv) as BufferSource }, key, unb64(entry.data) as BufferSource);
    const data = JSON.parse(new TextDecoder().decode(plain)) as FilingCredentials;
    if (typeof data.username !== "string" || typeof data.password !== "string" || !data.username || !data.password) throw new Error();
    return data;
  } catch (e) {
    if (e instanceof VaultError) throw e;
    throw new VaultError("Fjalëkalimi i kasafortës është i gabuar ose të dhënat janë dëmtuar.");
  }
}

export async function forget(nipt: string): Promise<void> {
  session.delete(nipt.toUpperCase());
  try {
    const id = await entryId(nipt);
    await idb("filing", "readwrite", (s) => s.delete(id));
  } catch {
    /* asgjë për të fshirë */
  }
}

/** Vetëm për testet: rreshti i ruajtur, për të vërtetuar që nuk ka tekst të lexueshëm. */
export async function __rawEntryForTests(nipt: string): Promise<unknown> {
  const id = await entryId(nipt);
  return idb("filing", "readonly", (s) => s.get(id));
}
