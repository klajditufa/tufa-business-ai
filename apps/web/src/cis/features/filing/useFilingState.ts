"use client";

/**
 * Përshtatësi i TUFA për useFilingState të cis-client-2: e njëjta formë (state, browser, mutate, browserAction),
 * por në vend të serverit lokal + shfletuesit Playwright, lidhja bëhet me shtesën "TUFA · e-Filing" në Chrome:
 *  - kredencialet e e-Albania mbahen në këtë shfletues (sesion ose kasafortë e enkriptuar; shih lib/filing/vault);
 *  - "browser/start" → shtesa hap portalin dhe hyn me e-Albania si Biznes; OTP-ja jepet këtu;
 *  - "command capture | focus", "navigate", "apply" → shtesa vepron në skedën e lidhur të portalit;
 *  - "review" ruhet këtu (si FilingAccount.prepare): "apply" pranon vetëm draftin e rishikuar për të njëjtin rishikim.
 * Asnjë deklaratë nuk dorëzohet; verifikimi, deklarimi dhe pagesat përfundohen në portalin zyrtar.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useCis } from "@/components/cis/cis-provider";
import { detectExtension, onStatus, request, MIN_EXTENSION, type FilingStatus } from "@/lib/filing/extension";
import type { BrowserState, FilingState, PortalSnapshot } from "./types";

type Outcome = FilingState["outcome"];
type ExtensionInfo = { version: string; current: boolean } | null | undefined;

const PORTAL_URL = "https://efiling.tatime.gov.al/cats_public/";
const RUNNING = new Set(["connecting", "otp", "otp-wrong", "verifying", "authenticated", "captcha"]);
const PORTAL_CODES = new Set(["changed", "taxpayer", "login", "unsupported", "nopage", "noextension", "expired"]);

const MESSAGES: Record<string, string> = {
  credentials: "Vendosni ose kontrolloni NUIS-in dhe fjalëkalimin e e-Albania për këtë subjekt.",
  changed: "Formulari në portal ndryshoi. Merreni përsëri.",
  review: "Kontrolloni subjektin, periudhën dhe shumat në portal përpara rishikimit.",
  expired: "Veprimi skadoi. Riprovoni lidhjen.",
};

export class FilingError extends Error {
  constructor(readonly code: string) {
    super(MESSAGES[code] ?? code);
  }
}

type Command = { kind: "capture" | "navigate" | "apply" | "focus"; payload?: Record<string, unknown> };

async function command(nipt: string, { kind, payload = {} }: Command): Promise<{ ok: boolean; code?: string; snapshot?: PortalSnapshot }> {
  const id = crypto.randomUUID();
  const reply = await new Promise<{ ok: boolean; code?: string; snapshot?: PortalSnapshot } | null>((resolve) => {
    const timer = setTimeout(() => done(null), kind === "navigate" ? 45000 : 20000);
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { source?: string; type?: string; id?: string; result?: { ok: boolean; code?: string; snapshot?: PortalSnapshot } };
      if (event.source !== window || event.origin !== window.location.origin || data?.source !== "tufa-extension") return;
      if (data.type === "filing-command-result" && data.id === id) done(data.result ?? null);
    };
    const done = (value: { ok: boolean; code?: string; snapshot?: PortalSnapshot } | null) => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(value);
    };
    window.addEventListener("message", onMessage);
    window.postMessage({ source: "tufa-app", type: "filing-command", id, kind, nipt, payload }, window.location.origin);
  });
  return reply ?? { ok: false, code: "noextension" };
}

export function useFilingState(business: string) {
  void business; // subjekti aktiv vjen nga CisProvider (një subjekt për faqe në TUFA)
  const cis = useCis();
  const nipt = cis.company.nipt.toUpperCase();
  const [extension, setExtension] = useState<ExtensionInfo>(undefined);
  const [job, setJob] = useState<string | null>(null);
  const [authentication, setAuthentication] = useState<FilingStatus | "">("");
  const [snapshot, setSnapshot] = useState<PortalSnapshot | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [review, setReview] = useState<FilingState["review"]>(null);
  const [pending, setPending] = useState<FilingState["command"]>(null);
  const [error, setError] = useState<unknown>(null);
  const [working, setWorking] = useState(false);
  const writing = useRef(false);

  useEffect(() => {
    let alive = true;
    const check = () => detectExtension().then((found) => alive && setExtension(found));
    void check();
    // Pas instalimit / përditësimit të shtesës, kthimi në faqe e gjen pa rifreskim.
    const visible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  const capture = useCallback(async (): Promise<PortalSnapshot | null> => {
    setPending({ id: "capture", kind: "capture", status: "pending" });
    const result = await command(nipt, { kind: "capture" });
    setPending(null);
    if (result.ok && result.snapshot) {
      setSnapshot(result.snapshot);
      setOutcome(null);
      return result.snapshot;
    }
    setOutcome({ ok: false, message: "", code: PORTAL_CODES.has(result.code ?? "") ? result.code : "captureFailed" });
    return null;
  }, [nipt]);

  // Gjendja e hyrjes nga shtesa; pas hyrjes merret menjëherë faqja (si shfletuesi i menaxhuar i cis-client).
  useEffect(() => {
    if (!job) return;
    return onStatus(job, (code) => {
      setAuthentication(code);
      if (code === "authenticated") void capture();
    });
  }, [job, capture]);

  const connected = !!extension?.current;
  const state: FilingState = {
    connectionKind: "managed",
    configured: cis.filing.configured,
    remembered: cis.filing.remembered,
    connected,
    username: cis.filing.username ?? "",
    snapshot,
    command: pending,
    outcome,
    review,
    portalUrl: PORTAL_URL,
  };
  const browser: BrowserState | null =
    extension === undefined
      ? null
      : {
          nodeAvailable: connected,
          installed: !!extension,
          installing: false,
          running: RUNNING.has(authentication),
          ready: authentication === "authenticated",
          channel: extension ? `TUFA · e-Filing ${extension.version}` : "",
          error: !extension ? "extension" : extension.current ? "" : "extensionOld",
          stopping: false,
          visible: true,
          authentication,
        };

  const start = useCallback(async () => {
    const creds = cis.filingCredentials();
    if (!creds) throw new FilingError("credentials");
    const id = crypto.randomUUID();
    setJob(id);
    setAuthentication("connecting");
    setOutcome(null);
    const result = await request("filing-login", { id, nipt, username: creds.username, password: creds.password });
    if (!result.ok) setAuthentication((result.code as FilingStatus) || "unavailable");
  }, [cis, nipt]);

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | null> => {
    if (writing.current) return null;
    writing.current = true;
    setWorking(true);
    setError(null);
    try {
      return await action();
    } catch (failure) {
      setError(failure);
      return null;
    } finally {
      writing.current = false;
      setWorking(false);
    }
  }, []);

  const mutate = useCallback(
    (path: string, body: unknown = {}, method: "POST" | "DELETE" = "POST"): Promise<FilingState | null> =>
      run(async () => {
        const input = (body ?? {}) as Record<string, unknown>;
        if (path === "credentials" && method === "DELETE") {
          await cis.forgetFiling();
          if (job) await request("filing-cancel", { id: job });
          setAuthentication("");
        } else if (path === "credentials") {
          await cis.saveFiling(
            { username: String(input.username ?? ""), password: String(input.password ?? "") },
            !!input.remember,
            String(input.passphrase ?? ""),
          );
          if (connected) void start();
        } else if (path === "unlock") {
          await cis.unlockFiling(String(input.passphrase ?? ""));
          if (connected) void start();
        } else if (path === "disconnect") {
          if (job) await request("filing-cancel", { id: job });
          setAuthentication("");
        } else if (path === "command") {
          if (input.kind === "capture") await capture();
          else if (input.kind === "focus") {
            const result = await command(nipt, { kind: "focus" });
            if (!result.ok) setOutcome({ ok: false, message: "", code: result.code });
          }
        } else if (path === "navigate") {
          setPending({ id: "navigate", kind: "navigate", status: "pending" });
          const result = await command(nipt, { kind: "navigate", payload: { revision: input.revision, key: input.key } });
          setPending(null);
          if (result.ok && result.snapshot) {
            setSnapshot(result.snapshot);
            setOutcome(null);
          } else setOutcome({ ok: false, message: "", code: PORTAL_CODES.has(result.code ?? "") ? result.code : "unsupported" });
        } else if (path === "review") {
          // Si FilingAccount.prepare: vetëm për rishikimin aktual dhe pas konfirmimit.
          if (!snapshot || input.revision !== snapshot.revision) throw new FilingError("changed");
          if (input.confirmed !== true) throw new FilingError("review");
          const edits = Object.fromEntries(Object.entries((input.edits ?? {}) as Record<string, unknown>).filter(([, v]) => typeof v === "string")) as Record<
            string,
            string
          >;
          setReview({ id: crypto.randomUUID(), revision: snapshot.revision, edits });
        } else if (path === "apply") {
          if (!review || input.reviewId !== review.id || !snapshot || review.revision !== snapshot.revision) throw new FilingError("changed");
          setPending({ id: "apply", kind: "apply", status: "pending" });
          const result = await command(nipt, { kind: "apply", payload: { revision: review.revision, edits: review.edits } });
          setPending(null);
          setReview(null);
          if (result.ok && result.snapshot) {
            setSnapshot(result.snapshot);
            setOutcome({ ok: true, message: "", code: "ok" });
          } else setOutcome({ ok: false, message: "", code: PORTAL_CODES.has(result.code ?? "") ? result.code : "unsupported" });
        } else if (path === "browser/verify") {
          if (!job) throw new FilingError("expired");
          const result = await request("filing-otp", { id: job, code: String(input.code ?? "") });
          if (!result.ok) setAuthentication((result.code as FilingStatus) || "unavailable");
        }
        return { ...state };
      }),
    // state rillogaritet në çdo render; mutate përdor vlerat e fundit
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, cis, job, connected, start, capture, nipt, snapshot, review],
  );

  const browserAction = useCallback(
    async (kind: "start" | "verify", body: unknown) => {
      if (kind === "verify") await mutate("browser/verify", body);
      else await run(start);
    },
    [mutate, run, start],
  );

  return { state, browser, extension, error, stale: false, working, mutate, browserAction, minExtension: MIN_EXTENSION };
}
