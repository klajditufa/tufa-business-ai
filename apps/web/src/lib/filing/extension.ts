"use client";

/** Lidhja me shtesën "TUFA · e-Filing" përmes window.postMessage (ura bridge.js, vetëm kjo origjinë). */

export const MIN_EXTENSION = "1.1.0";

export type FilingStatus =
  | "connecting"
  | "otp"
  | "otp-wrong"
  | "otp-failed"
  | "verifying"
  | "captcha"
  | "authenticated"
  | "credentials"
  | "taxpayer"
  | "portal"
  | "login"
  | "unsupported"
  | "unavailable"
  | "cancelled"
  | "closed";

export type PortalSnapshot = { url: string; title: string; nipt: string; tables: string[][][]; capturedAt: number };
export type ExtensionResult = { ok: boolean; code?: string; nipt?: string; snapshot?: PortalSnapshot };

type Incoming = { source?: string; type?: string; id?: string; version?: string; code?: string; result?: ExtensionResult };

function listen(match: (data: Incoming) => boolean, timeout: number): Promise<Incoming | null> {
  return new Promise((resolve) => {
    const done = (value: Incoming | null) => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(value);
    };
    const onMessage = (event: MessageEvent) => {
      const data = event.data as Incoming;
      if (event.source !== window || event.origin !== window.location.origin || data?.source !== "tufa-extension") return;
      if (match(data)) done(data);
    };
    const timer = setTimeout(() => done(null), timeout);
    window.addEventListener("message", onMessage);
  });
}

const newer = (a: string, b: string) => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return true;
};

/** Versioni i shtesës, ose null kur nuk është instaluar / nuk përgjigjet. */
export async function detectExtension(timeout = 1200): Promise<{ version: string; current: boolean } | null> {
  const reply = listen((d) => d.type === "ready", timeout);
  window.postMessage({ source: "tufa-app", type: "ping" }, window.location.origin);
  const data = await reply;
  if (!data?.version) return null;
  return { version: data.version, current: newer(data.version, MIN_EXTENSION) };
}

export async function request(type: "filing-login" | "filing-otp" | "filing-cancel" | "filing-capture", payload: Record<string, string>, timeout = 15000): Promise<ExtensionResult> {
  const id = payload.id;
  const reply = listen((d) => d.type === `${type}-result` && d.id === id, timeout);
  window.postMessage({ source: "tufa-app", type, ...payload }, window.location.origin);
  const data = await reply;
  return data?.result ?? { ok: false, code: "noextension" };
}

/** Gjendja e hyrjes për këtë id; kthen funksionin që ndalon dëgjimin. */
export function onStatus(id: string, callback: (code: FilingStatus) => void): () => void {
  const onMessage = (event: MessageEvent) => {
    const data = event.data as Incoming;
    if (event.source !== window || event.origin !== window.location.origin || data?.source !== "tufa-extension") return;
    if (data.type === "filing-status" && data.id === id && typeof data.code === "string") callback(data.code as FilingStatus);
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
