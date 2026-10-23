// Ruajtja e përkohshme e faqes së kapur deri sa TUFA ta marrë (një herë, brenda 15 minutash).
const TTL = 15 * 60 * 1000;

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (!message || typeof message !== "object") return;
  if (message.type === "tufa-store") {
    const id = crypto.randomUUID();
    chrome.storage.local.set({ [`capture:${id}`]: { at: Date.now(), snapshot: message.snapshot } }).then(() => reply({ id }));
    return true;
  }
  if (message.type === "tufa-take" && typeof message.id === "string" && /^[0-9a-f-]{36}$/.test(message.id)) {
    const key = `capture:${message.id}`;
    chrome.storage.local.get(key).then(async (items) => {
      await chrome.storage.local.remove(key);
      const item = items[key];
      reply(item && Date.now() - item.at < TTL ? { ok: true, snapshot: item.snapshot } : { ok: false, code: "expired" });
    });
    return true;
  }
});

// Pastrimi i kapjeve të vjetra.
chrome.runtime.onStartup.addListener(async () => {
  const all = await chrome.storage.local.get(null);
  const old = Object.entries(all).filter(([k, v]) => k.startsWith("capture:") && Date.now() - v.at > TTL).map(([k]) => k);
  if (old.length) await chrome.storage.local.remove(old);
});
