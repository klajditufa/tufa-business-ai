const TUFA = "https://tufa-business-ai.vercel.app";
const main = document.getElementById("main");
const ERRORS = {
  unsupported: "Hap një faqe të e-Filing (efiling.tatime.gov.al/cats_public).",
  login: "Hyr fillimisht në e-Filing me e-Albania.",
  taxpayer: "NIPT-i i subjektit nuk u gjet në kokën e faqes.",
  nopage: "Hap faqen e e-Filing në skedën aktive dhe provo sërish.",
};

function render(html) {
  main.innerHTML = html;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function kind(snapshot) {
  const all = snapshot.tables.flat().map((r) => r.join(" ")).join(" ").toLowerCase();
  if (/data e dorëzimit|data e dorezimit/.test(all) && /totali i tap|kontributet/.test(all)) return "Listëpagesa të dorëzuara";
  if (/numri personal|nr\.? personal|nid/.test(all) && /paga|bruto/.test(all)) return "Detajet e listëpagesës (E-SIG 025)";
  return null;
}

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (!tab || !tab.url || !tab.url.startsWith("https://efiling.tatime.gov.al/cats_public/")) return render(`<p class="err">${ERRORS.unsupported}</p>`);
  chrome.tabs.sendMessage(tab.id, { type: "tufa-capture" }, (result) => {
    if (chrome.runtime.lastError || !result) return render(`<p class="err">${ERRORS.nopage}</p>`);
    if (!result.ok) return render(`<p class="err">${ERRORS[result.code] || ERRORS.unsupported}</p>`);
    const s = result.snapshot;
    const k = kind(s);
    const rows = s.tables.reduce((a, t) => a + t.length, 0);
    render(`
      <div class="box">
        <div class="muted">Subjekti</div><div class="nipt">${esc(s.nipt)}</div>
        <div class="muted" style="margin-top:6px">Faqja</div><div>${esc(k || s.title || "Faqe e e-Filing")}</div>
        <div class="muted" style="margin-top:6px">${s.tables.length} tabela · ${rows} rreshta</div>
      </div>
      ${k ? "" : '<p class="muted">TUFA njeh tani listëpagesat (lista e dorëzuar dhe detajet). Faqet e tjera mund t\'i dërgosh, por do të shihen si tabela.</p>'}
      <button id="send">Dërgo në TUFA</button>
      <p id="status" class="muted"></p>`);
    document.getElementById("send").addEventListener("click", () => {
      const button = document.getElementById("send");
      button.disabled = true;
      chrome.runtime.sendMessage({ type: "tufa-store", snapshot: s }, ({ id }) => {
        const url = `${TUFA}/app/cats?nipt=${encodeURIComponent(s.nipt)}&capture=${id}`;
        chrome.tabs.create({ url });
        document.getElementById("status").innerHTML = '<span class="ok">U hap TUFA. Kontrollo paraparjen dhe shtyp “Importo”.</span>';
      });
    });
  });
});
