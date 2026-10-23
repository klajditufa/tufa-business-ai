// Ura me faqen e TUFA: faqja kërkon kapjen me id-në e saj; shtesa ia jep vetëm kësaj origjine.
(() => {
  const origin = location.origin;
  const announce = () => window.postMessage({ source: "tufa-extension", type: "ready", version: chrome.runtime.getManifest().version }, origin);
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== origin) return;
    const data = event.data;
    if (!data || data.source !== "tufa-app") return;
    if (data.type === "ping") announce();
    if (data.type === "cats-request" && typeof data.id === "string") {
      chrome.runtime.sendMessage({ type: "tufa-take", id: data.id }, (result) => {
        window.postMessage({ source: "tufa-extension", type: "cats-capture", id: data.id, result: result || { ok: false, code: "expired" } }, origin);
      });
    }
  });
  announce();
})();
