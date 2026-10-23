"use client";

/**
 * Klienti CIS në shfletues (si `cis_client/client.py`): nënshkruan me certifikatën e ruajtur këtu,
 * kalon nga /api/cis dhe lexon përgjigjen. Asnjë sekret nuk largohet nga ky kompjuter.
 */
import { bodies, buildSignedRequest, cisDateTime, type CisEnvironment, type CisOperation, type Signer, type XmlNode } from "./sign";
import { CisFault, CisXmlError, invoicesFrom, listFrom, operatorsFrom, responseBody, type CisInvoice, type XmlEl } from "./parse";

export const PAGE_SIZE = 1000;
const DETAIL_WORKERS = 4;

export class CisUnreachable extends Error {}

export type CisSession = { companyId: string; environment: CisEnvironment; signer: Signer };

export async function call(session: CisSession, operation: CisOperation, body: XmlNode[], retries = 1): Promise<XmlEl> {
  const built = await buildSignedRequest(operation, body, session.signer);
  let res: Response;
  try {
    res = await fetch("/api/cis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: session.companyId, environment: session.environment, operation, envelope: built.envelope }),
    });
  } catch {
    throw new CisUnreachable("Nuk ka lidhje me internetin ose me TUFA.");
  }
  if (!res.headers.get("X-CIS-Status")) {
    if (res.redirected || res.status === 401 || (res.headers.get("Content-Type") ?? "").includes("text/html")) {
      throw new Error("Sesioni ka skaduar. Rifresko faqen dhe hyr sërish.");
    }
    const err = (await res.json().catch(() => ({}))) as { error?: string; unreachable?: boolean };
    if (err.unreachable && retries > 0) return call(session, operation, body, retries - 1);
    if (err.unreachable) throw new CisUnreachable(err.error ?? "Fiskalizimi nuk u arrit.");
    throw new Error(err.error ?? `TUFA ktheu gabimin ${res.status}`);
  }
  const xml = await res.text();
  try {
    return responseBody(xml, operation, built.uuid);
  } catch (e) {
    // Gabimet e përkohshme të CIS (SERVER) provohen edhe një herë me mesazh të ri.
    if (e instanceof CisFault && e.temporary && retries > 0) return call(session, operation, body, retries - 1);
    if (e instanceof CisXmlError && retries > 0 && Number(res.headers.get("X-CIS-Status")) >= 500) return call(session, operation, body, retries - 1);
    throw e;
  }
}

const dayStart = (d: string) => `${d}T00:00:00${cisDateTime(new Date(`${d}T12:00:00Z`)).slice(-6)}`;
const dayEnd = (d: string) => `${d}T23:59:59${cisDateTime(new Date(`${d}T12:00:00Z`)).slice(-6)}`;
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

export type Kind = "SALES" | "PURCHASES";
export type Progress = (p: { phase: "list" | "details"; done: number; total: number; label: string }) => void;

/**
 * Të gjitha faturat e periudhës (VVVV-MM-DD). CIS refuzon periudha të gjata me gabimin 87:
 * atëherë periudha ndahet në gjysma, deri në një ditë (si iter_invoices i cis-client).
 */
export async function fetchInvoices(session: CisSession, kind: Kind, from: string, to: string, progress?: Progress): Promise<CisInvoice[]> {
  const seen = new Map<string, CisInvoice>();
  const pending: [string, string][] = [[from, to]];
  let fetched = 0;
  while (pending.length) {
    const [a, b] = pending.shift()!;
    let first: { invoices: CisInvoice[]; count: number };
    try {
      first = invoicesFrom(await call(session, "GetInvoices", bodies.invoicesByPeriod(kind, dayStart(a), dayEnd(b), 1)));
    } catch (e) {
      if (e instanceof CisFault && e.code === "87" && a < b) {
        const mid = addDays(a, Math.floor(daysBetween(a, b) / 2));
        pending.unshift([a, mid], [addDays(mid, 1), b]);
        continue;
      }
      throw e;
    }
    const pages = Math.max(1, Math.ceil(first.count / PAGE_SIZE));
    const add = (list: CisInvoice[]) => {
      for (const inv of list) seen.set(inv.FIC ?? `${inv.IIC ?? ""}-${seen.size}`, inv);
      fetched += list.length;
      progress?.({ phase: "list", done: fetched, total: fetched, label: `${a} – ${b}` });
    };
    add(first.invoices);
    for (let page = 2; page <= pages; page++) {
      add(invoicesFrom(await call(session, "GetInvoices", bodies.invoicesByPeriod(kind, dayStart(a), dayEnd(b), page))).invoices);
    }
  }
  return [...seen.values()];
}

/** Faturat e plota me artikujt, një kërkesë sipas FIC për secilën, katër njëkohësisht. */
export async function fetchDetails(session: CisSession, kind: Kind, invoices: CisInvoice[], progress?: Progress, signal?: AbortSignal): Promise<{ invoices: CisInvoice[]; failed: number }> {
  const result = [...invoices];
  const pending = result.map((inv, i) => (inv.FIC && !inv.Items ? i : -1)).filter((i) => i >= 0);
  let done = 0;
  let failed = 0;
  let next = 0;
  const worker = async () => {
    while (next < pending.length && !signal?.aborted) {
      const index = pending[next++];
      try {
        const { invoices: full } = invoicesFrom(await call(session, "GetInvoices", bodies.invoiceByFic(kind, result[index].FIC!)));
        if (full[0]) result[index] = full[0];
      } catch (e) {
        if (e instanceof CisUnreachable) throw e;
        failed++;
      }
      progress?.({ phase: "details", done: ++done, total: pending.length, label: "artikujt" });
    }
  };
  await Promise.all(Array.from({ length: Math.min(DETAIL_WORKERS, pending.length) }, worker));
  return { invoices: result, failed };
}

export const registry = {
  operators: async (s: CisSession) => operatorsFrom(await call(s, "GetOperators", bodies.none())),
  units: async (s: CisSession) => listFrom(await call(s, "GetBusinessUnits", bodies.none()), "BusinessUnits", "BusinessUnit"),
  tcrs: async (s: CisSession) => listFrom(await call(s, "GetTCRs", bodies.none()), "TCRs", "TCR"),
};

export { CisFault };
