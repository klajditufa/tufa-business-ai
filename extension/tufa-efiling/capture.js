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
  });
})();
