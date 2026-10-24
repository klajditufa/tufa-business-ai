// TUFA · e-Filing — leximi i faqes së hapur (përshtatur nga portal.ts i cis-client-2).
// Vetëm lexim: URL, titulli, NIPT-i i vetëm në kokën e faqes dhe tabelat e dukshme.
// Fushat e formularëve, fjalëkalimet dhe cookies nuk lexohen kurrë.
(() => {
  const PORTAL = "https://efiling.tatime.gov.al";
  const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const text = (el) => (el ? (typeof el.innerText === "string" ? el.innerText : el.textContent || "").trim() : "");

  function taxpayer() {
    const nodes = document.querySelectorAll(
      "header, nav, [role=banner], .navbar, .header, #header, #userInfo, .user-info, [id*=taxpayer i], [class*=taxpayer i], [id*=tax-payer i]",
    );
    const ids = new Set();
    for (const node of nodes) {
      if (!visible(node)) continue;
      const value = text(node).toUpperCase();
      if (value.length > 3000) continue;
      for (const id of value.match(/\b[A-Z]\d{8}[A-Z]\b/g) || []) ids.add(id);
    }
    return ids.size === 1 ? [...ids][0] : null;
  }

  function capture() {
    const url = new URL(location.href);
    if (url.origin !== PORTAL || !url.pathname.startsWith("/cats_public/")) return { ok: false, code: "unsupported" };
    if (document.querySelector('input[type="password"]')) return { ok: false, code: "login" };
    const nipt = taxpayer();
    if (!nipt) return { ok: false, code: "taxpayer" };
    const tableNodes = [...document.querySelectorAll("table")].filter(visible);
    if (tableNodes.length > 30) return { ok: false, code: "unsupported" };
    const tables = tableNodes.map((table) =>
      [...table.rows]
        .filter(visible)
        .slice(0, 2000)
        .map((row) => [...row.cells].slice(0, 80).map((cell) => (visible(cell) ? text(cell).replace(/\s+/g, " ").slice(0, 2000) : ""))),
    );
    return {
      ok: true,
      snapshot: { url: location.origin + location.pathname, title: document.title.slice(0, 300), nipt, tables, capturedAt: Date.now() },
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if (message && message.type === "tufa-capture") reply(capture());
    // Komandat e e-Filing nga TUFA (si content.ts i cis-client-2): lexim, destinacioni i navigimit,
    // zbatimi i ndryshimeve të rishikuara në fushat e formularit. Asgjë nuk dorëzohet.
    if (message && message.type === "filing-portal" && typeof message.nipt === "string") {
      const run = async () => {
        if (message.kind === "capture") return { ok: true, snapshot: await TufaPortal.capture(message.nipt) };
        if (message.kind === "destination") return { ok: true, url: await TufaPortal.destination(message.nipt, message.payload) };
        if (message.kind === "apply") return { ok: true, snapshot: await TufaPortal.apply(message.nipt, message.payload) };
        throw new Error("unsupported");
      };
      run().then(reply, (error) => {
        const code = error instanceof Error ? error.message : "unsupported";
        reply({ ok: false, code: ["changed", "taxpayer", "login", "unsupported"].includes(code) ? code : "unsupported" });
      });
      return true;
    }
  });

  // Hyrja e nisur nga TUFA (si cis-client-2): në portal vetëm klikohet lidhja "e-Albania".
  // Hyrja e vjetër e e-Filing (përdorues/fjalëkalim i C@TS) nuk plotësohet kurrë.
  const AUTH = /^https:\/\/(?:e-albania\.gov\.al|auth\.e-albania\.gov\.al|e-albania\.al)\//;
  function federationLink() {
    const links = [...document.querySelectorAll("a[href]")].filter((a) => {
      if (!visible(a)) return false;
      const name = a.getAttribute("aria-label") || text(a) || [...a.querySelectorAll("img[alt]")].map((i) => i.alt).join(" ");
      return /e[ -]?albania\s*(?:login|hyrje)?/i.test(name);
    });
    if (links.length !== 1) return null;
    try {
      const href = new URL(links[0].getAttribute("href"), location.href).href;
      return AUTH.test(href) ? { link: links[0], href } : null;
    } catch {
      return null;
    }
  }

  async function login(rounds) {
    for (let i = 0; i < rounds; i++) {
      const hasPassword = !!document.querySelector('input[type="password"]');
      const nipt = hasPassword ? null : taxpayer();
      const federation = federationLink();
      const final = i === rounds - 1;
      if (nipt || federation || final) {
        let reply;
        try {
          reply = await chrome.runtime.sendMessage({ type: "filing-page", where: "portal", taxpayer: nipt, hasPassword, federation: federation && federation.href, final });
        } catch {
          return;
        }
        const action = reply && reply.action;
        if (action === "click-federation" && federation) {
          federation.link.click();
          return;
        }
        if (action !== "wait") return;
      }
      await new Promise((r) => setTimeout(r, 700));
    }
  }
  void login(25);
})();
