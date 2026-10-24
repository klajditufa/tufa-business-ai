// Ura me faqen e TUFA. Kalon vetëm mesazhet e njohura, vetëm brenda kësaj origjine.
(() => {
  const origin = location.origin;
  const post = (data) => window.postMessage({ source: "tufa-extension", ...data }, origin);
  const announce = () => post({ type: "ready", version: chrome.runtime.getManifest().version });
  const str = (v, max) => (typeof v === "string" && v.length <= max ? v : "");

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== origin) return;
    const data = event.data;
    if (!data || data.source !== "tufa-app" || typeof data.type !== "string") return;
    const id = str(data.id, 64);
    if (data.type === "ping") return announce();
    if (data.type === "cats-request" && id) {
      chrome.runtime.sendMessage({ type: "tufa-take", id }, (result) => {
        post({ type: "cats-capture", id, result: result || { ok: false, code: "expired" } });
      });
      return;
    }
    const forward = {
      "filing-login": () => ({ type: "filing-login", id, nipt: str(data.nipt, 10), username: str(data.username, 10), password: str(data.password, 256) }),
      "filing-otp": () => ({ type: "filing-otp", id, code: str(data.code, 8) }),
      "filing-cancel": () => ({ type: "filing-cancel", id }),
      "filing-capture": () => ({ type: "filing-capture", id, nipt: str(data.nipt, 10) }),
    }[data.type];
    if (!forward || !id) return;
    chrome.runtime.sendMessage(forward(), (result) => {
      post({ type: `${data.type}-result`, id, result: result || { ok: false, code: "unavailable" } });
    });
  });

  // Gjendja e hyrjes nga shërbimi i shtesës (pa fjalëkalime).
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === "filing-status") post({ type: "filing-status", id: message.id, code: message.code });
  });
  announce();
})();
