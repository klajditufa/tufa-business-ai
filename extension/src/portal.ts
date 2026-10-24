// Përshtatur pa ndryshime logjike nga cis-client-2 frontend/companion/portal.ts.
// Burimi; `scripts/build-extension.sh` e përkthen në extension/tufa-efiling/portal.js (globalThis.TufaPortal).
import type { PortalField, PortalSnapshot } from "./types";

export const PORTAL_URL = "https://efiling.tatime.gov.al/cats_public/";
const sensitive = /password|passwd|secret|token|csrf|verification|captcha|\botp\b/i;
const allowed = new Set(["text", "number", "date", "checkbox", "radio", "email", "tel", "url"]);
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const controlValue = (element: Control): string =>
  element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)
    ? String(element.checked)
    : element.value;
const visible = (element: Element): boolean =>
  element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
const text = (element: Element | null): string => {
  if (!element) return "";
  const displayed: unknown = Reflect.get(element, "innerText");
  return (typeof displayed === "string" ? displayed : element.textContent).trim();
};

export function isPortalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      url.origin === "https://efiling.tatime.gov.al" &&
      url.pathname.startsWith("/cats_public/")
    );
  } catch {
    return false;
  }
}

/** Literal portal links only. Legacy layouts can wrap their entire menu in a form. */
function navigation() {
  const menuLinks = new Set<HTMLAnchorElement>();
  for (const root of document.querySelectorAll(
    "nav, header, aside, [role=navigation], .sidebar, .menu, .navbar, .nav, .navigation, #mainMenu, #main-menu, #navigation",
  )) {
    if (root.matches("html, body, main, form, table, .dropdown-menu, .context-menu")) continue;
    for (const anchor of root.querySelectorAll<HTMLAnchorElement>("a[href]")) {
      if (!anchor.closest("table, .dropdown-menu, .context-menu")) menuLinks.add(anchor);
    }
  }
  const links = [...new Set([...menuLinks, ...document.querySelectorAll<HTMLAnchorElement>("a[href]")])];
  const seen = new Set<string>();
  return links
    .flatMap((anchor, index) => {
      const label = text(anchor);
      const href = anchor.getAttribute("href") ?? "";
      if (
        !visible(anchor) ||
        !label ||
        label.length > 160 ||
        anchor.hasAttribute("download") ||
        anchor.hasAttribute("onclick") ||
        anchor.closest("form")?.querySelector('input[type="password"]') ||
        href.startsWith("#") ||
        !href.trim()
      )
        return [];
      let url: URL;
      try {
        url = new URL(href, location.href);
      } catch {
        return [];
      }
      if (!isPortalUrl(url.href) || url.href.length > 2000 || url.hash || seen.has(url.href)) return [];
      // Row links outside navigation must identify an explicit read operation.
      if (
        !menuLinks.has(anchor) &&
        !/\/(?:index|details?|list|view|search|shiko)(?:\/[a-z0-9_-]+)?\/?$/i.test(url.pathname)
      )
        return [];
      let action: string;
      try {
        action = `${decodeURIComponent(url.pathname + url.search)} ${label}`
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/([a-z0-9])([A-Z])/g, "$1 $2");
      } catch {
        return [];
      }
      if (
        sensitive.test(action) ||
        /(?:^|[^a-z])(?:log[ _-]?(?:in|on|out|off)|sign|delete|remove|submit|save|confirm|execute|approve|cancel|close|send|download|export|get[ _-]?pdf|pay(?!ments?(?:[^a-z]|$)|ers?(?:[^a-z]|$)|ees?(?:[^a-z]|$)|roll)|paguaj|dergo|deklaro|dorezo|anulo|nenshkruaj|mbyll|shkarko|ruaj|fshi|konfirmo|dil)[a-z0-9_-]*(?:[^a-z]|$)/i.test(
          action,
        ) ||
        [...url.searchParams].some(
          ([key, value]) =>
            /^(action|command|do|method|operation)$/i.test(key) &&
            !/^(index|view|list|details|search)$/i.test(value),
        )
      )
        return [];
      seen.add(url.href);
      return [{ key: `n${index}`, label, url: url.href }];
    })
    .slice(0, 100);
}

function checkUrl(): void {
  if (!isPortalUrl(location.href)) throw Error("unsupported");
}

function taxpayer(expected: string): string {
  const nodes = document.querySelectorAll(
    "header, nav, [role=banner], .navbar, .header, #header, #userInfo, .user-info, " +
      "[id*=taxpayer i], [class*=taxpayer i], [id*=tax-payer i]",
  );
  const ids = new Set<string>();
  for (const node of nodes) {
    if (!visible(node)) continue;
    const value = text(node).toUpperCase();
    if (value.length > 3000) continue;
    for (const id of value.match(/\b[A-Z]\d{8}[A-Z]\b/g) ?? []) ids.add(id);
  }
  if (ids.size !== 1 || !ids.has(expected)) throw Error("taxpayer");
  return expected;
}

function describe(element: Control, key: string): PortalField | null {
  if (!visible(element) || sensitive.test(`${element.name} ${element.id}`)) return null;
  const originalType =
    element instanceof HTMLInputElement ? element.type.toLowerCase() : element.tagName.toLowerCase();
  if (element instanceof HTMLInputElement && !allowed.has(originalType)) return null;
  if (element.closest("form")?.querySelector('input[type="password"]')) return null;
  const type = (
    ["email", "tel", "url"].includes(originalType) ? "text" : originalType
  ) as PortalField["type"];
  let label = [...(element.labels ?? [])].map(text).join(" · ");
  label ||= element.getAttribute("aria-label") || element.getAttribute("placeholder") || "";
  label ||= text(element.closest("td")?.previousElementSibling ?? null);
  label ||= element.name || element.id || key;
  if (label.length > 500) throw Error("unsupported");
  const value = controlValue(element);
  const options =
    element instanceof HTMLSelectElement
      ? [...element.options].map((option) => ({ value: option.value, label: text(option) }))
      : [];
  if (options.some((option) => option.label.length > 500 || option.value.length > 1000))
    throw Error("unsupported");
  if (value.length > 10000 || options.length > 500) throw Error("unsupported");
  return {
    key,
    label,
    type,
    value,
    readOnly:
      element.disabled ||
      element.matches(":disabled") ||
      element.getAttribute("aria-disabled") === "true" ||
      element.getAttribute("aria-readonly") === "true" ||
      (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
        ? element.readOnly
        : element.multiple) ||
      type === "radio",
    options,
  };
}

function controls() {
  const roots: (HTMLFormElement | Document)[] = [...document.forms, document];
  return roots.map((root, formIndex) => {
    const fields = [...root.querySelectorAll<Control>("input, textarea, select")].flatMap(
      (element, index) => {
        if (root === document && element.closest("form")) return [];
        const field = describe(element, `f${formIndex}:c${index}`);
        return field ? [{ field, element }] : [];
      },
    );
    return { root, fields };
  });
}

function pageData(nipt: string) {
  checkUrl();
  if (location.href.length > 4000 || document.forms.length > 50) throw Error("unsupported");
  taxpayer(nipt);
  const groups = controls();
  if (groups.reduce((sum, group) => sum + group.fields.length, 0) > 1500) throw Error("unsupported");
  const forms = groups
    .filter((group) => group.fields.length)
    .map(({ root, fields }, index) => ({
      title:
        text(root.querySelector("legend, h1, h2, h3")) ||
        (root instanceof HTMLElement ? root.getAttribute("aria-label") : "") ||
        `#${index + 1}`,
      fields: fields.map(({ field }) => field),
    }));
  if (forms.length > 50 || forms.some((form) => form.title.length > 500)) throw Error("unsupported");
  const tableNodes = [...document.querySelectorAll("table")].filter(visible);
  if (tableNodes.length > 30) throw Error("unsupported");
  const tables = tableNodes.map((table) => {
    const rows = [...table.rows].filter(visible);
    if (rows.length > 500) throw Error("unsupported");
    return rows.map((row) => {
      if (row.cells.length > 80) throw Error("unsupported");
      return [...row.cells].map((cell) => {
        const value = visible(cell) ? text(cell) : "";
        if (value.length > 2000) throw Error("unsupported");
        return value;
      });
    });
  });
  return {
    url: location.href,
    title: document.title.slice(0, 500),
    nipt,
    forms,
    tables,
    navigation: navigation(),
  };
}

export async function destination(
  nipt: string,
  { revision, key }: { revision: string; key: string },
): Promise<string> {
  const before = await capture(nipt);
  if (before.revision !== revision) throw Error("changed");
  const current = pageData(nipt);
  const link = current.navigation.find((item) => item.key === key);
  if (!link || JSON.stringify(current.navigation) !== JSON.stringify(before.navigation))
    throw Error("changed");
  return link.url;
}

export async function capture(nipt: string): Promise<PortalSnapshot> {
  const data = pageData(nipt);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(data)));
  const revision = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return { ...data, revision, capturedAt: Date.now() / 1000 };
}

function setValue(element: Control, value: string): void {
  const checkbox = element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type);
  const property = checkbox ? "checked" : "value";
  const prototype: object = Object.getPrototypeOf(element) as object;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
  if (!descriptor?.set) throw Error("unsupported");
  descriptor.set.call(element, checkbox ? value === "true" : value);
}

export async function apply(
  nipt: string,
  { revision, edits }: { revision: string; edits: Record<string, string> },
): Promise<PortalSnapshot> {
  const before = await capture(nipt);
  if (before.revision !== revision) throw Error("changed");
  // Hashing yields to the page. Check the current DOM synchronously before any edits.
  const captured = {
    url: before.url,
    title: before.title,
    nipt: before.nipt,
    forms: before.forms,
    tables: before.tables,
    navigation: before.navigation,
  };
  if (JSON.stringify(pageData(nipt)) !== JSON.stringify(captured)) throw Error("changed");
  const byKey = new Map(
    controls().flatMap(({ fields }) => fields.map((item) => [item.field.key, item] as const)),
  );
  const changes = Object.entries(edits).map(([key, value]) => {
    const item = byKey.get(key);
    if (!item || item.field.readOnly || typeof value !== "string" || value.length > 10000)
      throw Error("unsupported");
    if (item.field.type === "select" && !item.field.options.some((option) => option.value === value))
      throw Error("unsupported");
    if (item.field.type === "checkbox" && !["true", "false"].includes(value)) throw Error("unsupported");
    // Native constraints are checked on a detached clone before changing any live control.
    const candidate = item.element.cloneNode(true) as Control;
    setValue(candidate, value);
    if (controlValue(candidate) !== value || !candidate.checkValidity()) throw Error("unsupported");
    return { ...item, value };
  });
  for (const { element, value } of changes) setValue(element, value);
  for (const { element, value } of changes) {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    const actual = controlValue(element);
    if (actual !== value || !element.isConnected) throw Error("changed");
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
  const after = await capture(nipt);
  const values = new Map(
    after.forms.flatMap((form) => form.fields.map((field) => [field.key, field.value] as const)),
  );
  if (Object.entries(edits).some(([key, value]) => values.get(key) !== value)) throw Error("changed");
  return after;
}
