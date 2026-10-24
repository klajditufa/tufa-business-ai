// TUFA · e-Filing — hyrja në e-Albania si "Biznes" (përshtatur nga managed-browser/login.ts i cis-client-2).
// Vepron vetëm kur shërbimi i shtesës ka një hyrje të nisur nga TUFA për këtë skedë.
// Plotëson vetëm formularët e identifikimit të e-Albania; CAPTCHA nuk prekët; OTP-në e jep përdoruesi.
(() => {
  const AUTH_HOSTS = new Set(["e-albania.gov.al", "auth.e-albania.gov.al", "e-albania.al"]);
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
  if (!isAuthenticationUrl(location.href)) return;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const text = (el) => (typeof el.innerText === "string" ? el.innerText : el.textContent || "").trim();
  const unique = (nodes) => {
    const shown = [...nodes].filter(visible);
    return shown.length === 1 ? shown[0] : null;
  };
  const OTP = 'input#otp, input[name="otp"], input[autocomplete="one-time-code"], input[name="totp"]';
  const USER = 'input#username, input[name="username"], input[placeholder*="NUIS" i], input[placeholder*="NIPT" i], input[id$="UserName"]';

  function observe() {
    return {
      captcha:
        !!document.querySelector('iframe[src*="recaptcha"], iframe[src*="hcaptcha"]') ||
        [...document.querySelectorAll('input[name*="captcha" i]')].some(visible),
      otp: !!unique(document.querySelectorAll(OTP)),
      password: !!unique(document.querySelectorAll('input[type="password"]')),
      error: !!document.querySelector("#MainContent_lblFatalError, #kc-error-message"),
    };
  }

  /** Formulari duhet të dërgojë te e njëjta faqe identifikimi e e-Albania, në të njëjtën skedë. */
  function safeForm(input) {
    const form = input.closest("form");
    if (!form) throw new Error("login");
    const resolved = new URL(form.getAttribute("action") || location.href, location.href);
    const target = form.getAttribute("target");
    if (!isAuthenticationUrl(resolved.href) || resolved.origin !== location.origin || (target && target !== "_self")) throw new Error("login");
    return form;
  }

  function setValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    input.focus();
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function submit(form) {
    const button = unique(form.querySelectorAll('#kc-login, button[type="submit"], input[type="submit"], input[type="image"]'));
    if (!button || button.hasAttribute("formaction") || button.hasAttribute("formtarget")) throw new Error("login");
    button.click();
  }

  async function fill(username, password) {
    const business =
      unique(document.querySelectorAll("#business-tab")) ||
      unique([...document.querySelectorAll('[role="tab"]')].filter((t) => /^(?:biznes|business)$/i.test(text(t))));
    if (business && business.getAttribute("aria-selected") !== "true") {
      business.click();
      await sleep(400);
    }
    const pw = unique(document.querySelectorAll('input[type="password"]'));
    if (!pw) return "login";
    const form = safeForm(pw);
    const accountType = form.querySelector("#account_type");
    const businessSelected = !!accountType && accountType.value === "business";
    const selectedTab = !!business && business.getAttribute("aria-selected") === "true";
    if (!businessSelected && !selectedTab) return "unsupported";
    const user = unique(form.querySelectorAll(USER));
    if (!user) return "login";
    setValue(user, username);
    setValue(pw, password);
    submit(form);
    return "submitted";
  }

  function fillOtp(code) {
    const input = unique(document.querySelectorAll(OTP));
    if (!input) return "login";
    const form = safeForm(input);
    setValue(input, code);
    submit(form);
    return "submitted";
  }

  let running = false;
  async function run(rounds) {
    if (running) return;
    running = true;
    try {
      for (let i = 0; i < rounds; i++) {
        const seen = observe();
        const final = i === rounds - 1;
        const actionable = seen.captcha || seen.otp || seen.password || seen.error;
        if (actionable || final) {
          const reply = await chrome.runtime.sendMessage({ type: "filing-page", where: "auth", ...seen, final });
          const action = reply && reply.action;
          if (!action || action === "none" || action === "done") return;
          if (action === "fill" || action === "otp") {
            let code;
            try {
              code = action === "fill" ? await fill(reply.username, reply.password) : fillOtp(reply.code);
            } catch {
              code = "unsupported";
            }
            if (code !== "submitted") chrome.runtime.sendMessage({ type: "filing-result", code });
            return;
          }
        }
        await sleep(500);
      }
    } finally {
      running = false;
    }
  }

  // Kodi OTP mbërriti nga TUFA: vëzhgo sërish faqen.
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === "filing-otp-ready") void run(6);
  });
  void run(30);
})();
