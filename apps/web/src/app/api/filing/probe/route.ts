import { NextResponse } from "next/server";

/**
 * Provë e përkohshme: a arrin serveri e-Filing dhe hyrjen e e-Albania, dhe çfarë formularësh ka rruga e hyrjes?
 * Vetëm GET në faqe publike; nuk dërgohet asnjë kredencial. Kthen vetëm strukturën (host, status, emrat e fushave).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Hop = { body?: string; url: string; status: number; location?: string; forms?: { action: string; method: string; fields: string[] }[]; links?: string[]; title?: string; captcha?: boolean; bytes?: number };

function forms(html: string) {
  return [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)].slice(0, 6).map((m) => ({
    action: /action=["']([^"']*)["']/i.exec(m[1])?.[1]?.slice(0, 200) ?? "",
    method: /method=["']([^"']*)["']/i.exec(m[1])?.[1] ?? "get",
    fields: [...m[2].matchAll(/<input\b[^>]*>/gi)].map((i) => `${/type=["']([^"']*)/i.exec(i[0])?.[1] ?? "text"}:${/name=["']([^"']*)/i.exec(i[0])?.[1] ?? /id=["']([^"']*)/i.exec(i[0])?.[1] ?? "?"}`).slice(0, 20),
  }));
}

export async function GET() {
  const hops: Hop[] = [];
  const jar = new Map<string, string>();
  let url = "https://efiling.tatime.gov.al/cats_public/";
  try {
    for (let i = 0; i < 8; i++) {
      const host = new URL(url).host;
      const cookie = [...jar.entries()].filter(([k]) => k.startsWith(host + "|")).map(([k, v]) => `${k.split("|")[1]}=${v}`).join("; ");
      const r = await fetch(url, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 TUFA-probe", ...(cookie ? { Cookie: cookie } : {}) }, signal: AbortSignal.timeout(15000) });
      for (const c of r.headers.getSetCookie?.() ?? []) {
        const [kv] = c.split(";");
        const [k, ...v] = kv.split("=");
        jar.set(`${host}|${k.trim()}`, v.join("="));
      }
      const loc = r.headers.get("location") ?? undefined;
      const html = r.status >= 300 && r.status < 400 ? "" : await r.text();
      const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
        .filter((m) => /albania/i.test(m[2] + m[1]))
        .map((m) => `${m[2].replace(/<[^>]+>/g, "").trim().slice(0, 40)} -> ${m[1].slice(0, 160)}`);
      hops.push({ url: url.slice(0, 200), status: r.status, location: loc?.slice(0, 200), forms: html ? forms(html) : undefined, links: links.slice(0, 5), title: /<title>([^<]*)/i.exec(html)?.[1]?.trim(), captcha: /recaptcha|hcaptcha|turnstile|captcha/i.test(html), bytes: html.length, ...(html.length < 2000 ? { body: html.replace(/\s+/g, " ").slice(0, 600) } : {}) } as Hop);
      if (loc) {
        url = new URL(loc, url).href;
        continue;
      }
      const refresh = /http-equiv=["']?refresh["']?[^>]*url=([^"'>]+)/i.exec(html)?.[1] ?? /location(?:\.href)?\s*=\s*["']([^"']+)["']/i.exec(html)?.[1];
      if (refresh && html.length < 2000) {
        url = new URL(refresh.replace(/&amp;/g, "&"), url).href;
        continue;
      }
      // Ndjek lidhjen "E-Albania Login" një herë
      const ea = /<a\b[^>]*href=["']([^"']+)["'][^>]*>[\s\S]{0,200}?e[ -]?albania[\s\S]{0,40}?<\/a>/i.exec(html);
      if (ea && !hops.some((h) => h.url.includes("e-albania"))) {
        url = new URL(ea[1].replace(/&amp;/g, "&"), url).href;
        continue;
      }
      break;
    }
  } catch (e) {
    hops.push({ url, status: 0, location: String((e as Error).cause ?? e).slice(0, 200) });
  }
  return NextResponse.json({ region: process.env.VERCEL_REGION ?? null, hops });
}
