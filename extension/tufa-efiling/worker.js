// TUFA · e-Filing — shërbimi i shtesës.
//  1. Ruan për 15 minuta faqen e kapur nga popup-i, deri sa TUFA ta marrë një herë.
//  2. Hyrja në e-Filing me e-Albania, si "managed browser" i cis-client-2 (managed-browser/login.ts):
//     hapet portali, klikohet "e-Albania", zgjidhet "Biznes", plotësohen NUIS + fjalëkalimi dhe dërgohet
//     formulari i e-Albania NJË herë. Kodi OTP e jep përdoruesi te TUFA; CAPTCHA plotësohet nga përdoruesi.
//     Hyrja e vjetër e e-Filing (Account/LogOn) nuk plotësohet kurrë.
//  Fjalëkalimi mbahet vetëm në chrome.storage.session (në kujtesë, jo në disk, i palexueshëm nga
//  content scripts) dhe fshihet sapo plotësohet ose kur hyrja mbaron / skadon.
const TTL = 15 * 60 * 1000;
const JOB_MS = 4 * 60 * 1000;
const PORTAL_URL = "https://efiling.tatime.gov.al/cats_public/";
const TUFA_ORIGINS = new Set(["https://tufa-business-ai.vercel.app", "http://localhost:3000"]);
const AUTH_HOSTS = new Set(["e-albania.gov.al", "auth.e-albania.gov.al", "e-albania.al"]);
const NIPT = /^[A-Z]\d{8}[A-Z]$/;
const ID = /^[0-9a-zA-Z-]{8,64}$/;

function isPortalUrl(value) {
  try {
    const url = new URL(value);
    return !url.username && !url.password && url.origin === "https://efiling.tatime.gov.al" && url.pathname.startsWith("/cats_public/");
  } catch {
    return false;
  }
}

function isAuthenticationUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.port || url.username || url.password) return false;
    return (
      AUTH_HOSTS.has(url.hostname) &&
      (/^\/(?:fpsts|ipsts)(?:\/|$)/i.test(url.pathname) ||
        (url.hostname === "auth.e-albania.gov.al" && url.pathname.startsWith("/realms/govgateway/")) ||
        (url.hostname === "e-albania.al" && url.pathname.startsWith("/auth/")))
    );
  } catch {
    return false;
  }
}

/** Mesazhi vjen nga ura në faqen e TUFA (jo nga një faqe tjetër). */
const fromTufa = (sender) => sender.id === chrome.runtime.id && !!sender.tab && TUFA_ORIGINS.has(sender.origin);
const fromPopup = (sender) => sender.id === chrome.runtime.id && !sender.tab && (sender.url || "").startsWith(chrome.runtime.getURL("popup.html"));

// ---------------------------------------------------------------------------
// Puna e hyrjes (një në një kohë)
// ---------------------------------------------------------------------------
async function getJob() {
  const { job } = await chrome.storage.session.get("job");
  if (!job) return null;
  if (Date.now() > job.deadline) {
    await finish(job, "unavailable");
    return null;
  }
  return job;
}
const setJob = (job) => chrome.storage.session.set({ job });

function notify(job, code) {
  chrome.tabs.sendMessage(job.tufaTab, { type: "filing-status", id: job.id, code }).catch(() => {});
}

async function finish(job, code) {
  await chrome.storage.session.remove("job");
  notify(job, code);
}

async function startLogin(m, sender) {
  if (
    typeof m.id !== "string" || !ID.test(m.id) ||
    typeof m.nipt !== "string" || !NIPT.test(m.nipt) ||
    typeof m.username !== "string" || typeof m.password !== "string" ||
    !m.password || m.password.length > 256
  ) {
    return { ok: false, code: "credentials" };
  }
  // Kredencialet mbeten te identiteti i subjektit të zgjedhur (si cis-client): NUIS = NIPT-i i subjektit.
  if (m.username.trim().toUpperCase() !== m.nipt) return { ok: false, code: "credentials" };
  const previous = await getJob();
  if (previous) await finish(previous, "cancelled");
  const job = {
    id: m.id,
    tufaTab: sender.tab.id,
    nipt: m.nipt,
    username: m.nipt,
    password: m.password,
    portalTab: null,
    clickedFederation: false,
    entered: false,
    manual: false,
    code: null,
    otpTries: 0,
    otpSubmitted: false,
    deadline: Date.now() + JOB_MS,
  };
  await setJob(job);
  const { portalTab } = await chrome.storage.session.get("portalTab");
  let tab = null;
  if (portalTab) tab = await chrome.tabs.update(portalTab, { url: PORTAL_URL, active: true }).catch(() => null);
  if (!tab) tab = await chrome.tabs.create({ url: PORTAL_URL, active: true });
  if (tab.windowId !== undefined) chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
  const current = await getJob();
  if (!current || current.id !== job.id) return { ok: false, code: "cancelled" };
  current.portalTab = tab.id;
  await setJob(current);
  await chrome.storage.session.set({ portalTab: tab.id });
  notify(current, "connecting");
  return { ok: true };
}

/** Vëzhgimi nga capture.js (portali) ose login.js (e-Albania) në skedën e hyrjes. */
async function onPage(m, sender) {
  const job = await getJob();
  if (!job) return { action: "none" };
  if (!sender.tab || sender.tab.id !== job.portalTab) return { action: job.portalTab === null ? "wait" : "none" };
  const url = sender.url || "";

  if (m.where === "portal" && isPortalUrl(url)) {
    const taxpayer = typeof m.taxpayer === "string" ? m.taxpayer.toUpperCase() : null;
    if (taxpayer && !m.hasPassword) {
      await finish(job, taxpayer === job.nipt ? "authenticated" : "taxpayer");
      return { action: "done" };
    }
    if (typeof m.federation === "string" && isAuthenticationUrl(m.federation) && !job.clickedFederation && !job.entered && !job.manual) {
      job.clickedFederation = true;
      await setJob(job);
      return { action: "click-federation" };
    }
    if (m.final) {
      // Kurrë nuk plotësohet hyrja e vjetër e e-Filing: përdoruesi vazhdon vetë në portal.
      await finish(job, m.hasPassword ? (job.entered ? "credentials" : "login") : "portal");
      return { action: "done" };
    }
    return { action: "wait" };
  }

  if (m.where === "auth" && isAuthenticationUrl(url)) {
    if (m.captcha) {
      // CAPTCHA nuk anashkalohet: fjalëkalimi hidhet dhe përdoruesi vazhdon vetë në portal.
      job.password = "";
      job.manual = true;
      await setJob(job);
      notify(job, "captcha");
      return { action: "done" };
    }
    if (m.otp) {
      if (job.code) {
        const code = job.code;
        job.code = null;
        job.otpSubmitted = true;
        await setJob(job);
        return { action: "otp", code };
      }
      const wrong = job.otpSubmitted;
      job.otpSubmitted = false;
      await setJob(job);
      notify(job, wrong ? "otp-wrong" : "otp");
      return { action: "done" };
    }
    if (m.password) {
      if (job.entered) {
        // Fjalëkalimi i dërguar nuk riprovohet kurrë.
        await finish(job, "credentials");
        return { action: "done" };
      }
      if (job.manual || !job.password) return { action: "done" };
      const fill = { action: "fill", username: job.username, password: job.password };
      job.entered = true;
      job.password = "";
      await setJob(job);
      return fill;
    }
    if (m.error) {
      await finish(job, "unavailable");
      return { action: "done" };
    }
    if (m.final) {
      await finish(job, "unsupported");
      return { action: "done" };
    }
    return { action: "wait" };
  }
  return { action: "none" };
}

async function onResult(m, sender) {
  const job = await getJob();
  if (!job || !sender.tab || sender.tab.id !== job.portalTab) return;
  const allowed = ["unsupported", "login", "credentials", "unavailable"];
  await finish(job, allowed.includes(m.code) ? m.code : "unsupported");
}

async function onOtp(m) {
  const job = await getJob();
  if (!job || job.id !== m.id) return { ok: false, code: "expired" };
  if (typeof m.code !== "string" || !/^\d{4,8}$/.test(m.code)) return { ok: false, code: "otp" };
  if (job.otpTries >= 3) {
    await finish(job, "otp-failed");
    return { ok: false, code: "otp-failed" };
  }
  job.code = m.code;
  job.otpTries += 1;
  await setJob(job);
  notify(job, "verifying");
  chrome.tabs.sendMessage(job.portalTab, { type: "filing-otp-ready" }).catch(() => {});
  return { ok: true };
}

async function onCancel(m) {
  const job = await getJob();
  if (job && job.id === m.id) await finish(job, "cancelled");
  return { ok: true };
}

/** Merr faqen e hapur të portalit (skeda e hyrjes, ose skeda e fundit e e-Filing). */
async function onCapture(m) {
  if (typeof m.nipt !== "string" || !NIPT.test(m.nipt)) return { ok: false, code: "taxpayer" };
  const tabs = await chrome.tabs.query({ url: "https://efiling.tatime.gov.al/cats_public/*" });
  if (!tabs.length) return { ok: false, code: "nopage" };
  const { portalTab } = await chrome.storage.session.get("portalTab");
  const tab = tabs.find((t) => t.id === portalTab) || tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
  let result;
  try {
    result = await chrome.tabs.sendMessage(tab.id, { type: "tufa-capture" });
  } catch {
    return { ok: false, code: "nopage" };
  }
  if (!result || !result.ok) return result || { ok: false, code: "nopage" };
  if (result.snapshot.nipt !== m.nipt) return { ok: false, code: "taxpayer", nipt: result.snapshot.nipt };
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!message || typeof message !== "object") return;
  const run = (promise) => {
    promise.then(reply, () => reply({ ok: false, code: "unavailable" }));
    return true;
  };
  switch (message.type) {
    case "tufa-store": {
      if (!fromPopup(sender)) return;
      const id = crypto.randomUUID();
      return run(chrome.storage.local.set({ [`capture:${id}`]: { at: Date.now(), snapshot: message.snapshot } }).then(() => ({ id })));
    }
    case "tufa-take": {
      if (!fromTufa(sender) || typeof message.id !== "string" || !/^[0-9a-f-]{36}$/.test(message.id)) return;
      const key = `capture:${message.id}`;
      return run(
        chrome.storage.local.get(key).then(async (items) => {
          await chrome.storage.local.remove(key);
          const item = items[key];
          return item && Date.now() - item.at < TTL ? { ok: true, snapshot: item.snapshot } : { ok: false, code: "expired" };
        }),
      );
    }
    case "filing-login":
      return fromTufa(sender) ? run(startLogin(message, sender)) : undefined;
    case "filing-otp":
      return fromTufa(sender) ? run(onOtp(message)) : undefined;
    case "filing-cancel":
      return fromTufa(sender) ? run(onCancel(message)) : undefined;
    case "filing-capture":
      return fromTufa(sender) ? run(onCapture(message)) : undefined;
    case "filing-page":
      return sender.id === chrome.runtime.id ? run(onPage(message, sender)) : undefined;
    case "filing-result":
      if (sender.id === chrome.runtime.id) void onResult(message, sender);
      return;
  }
});

// Pastrimi i kapjeve të vjetra.
chrome.runtime.onStartup.addListener(async () => {
  const all = await chrome.storage.local.get(null);
  const old = Object.entries(all).filter(([k, v]) => k.startsWith("capture:") && Date.now() - v.at > TTL).map(([k]) => k);
  if (old.length) await chrome.storage.local.remove(old);
});

// Skeda e portalit u mbyll gjatë hyrjes.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const job = await getJob();
  if (job && job.portalTab === tabId) await finish(job, "closed");
});
