import { NextResponse } from "next/server";

/** Provë lidhjeje: a arrin serveri te CIS? Lexon vetëm WSDL-të publike (pa të dhëna, pa certifikatë). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";

const URLS = [
  "https://efiskalizimi.tatime.gov.al/FiscalizationDataService-v1/FiscalizationDataService.wsdl",
  "https://efiskalizimi-test.tatime.gov.al/FiscalizationDataService-v1/FiscalizationDataService.wsdl",
  "https://einvoice.tatime.gov.al/EinvoiceService-v1/EinvoiceService.wsdl",
];

export async function GET() {
  const results = await Promise.all(
    URLS.map(async (url) => {
      const started = Date.now();
      try {
        const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
        return { url, status: r.status, ms: Date.now() - started };
      } catch (e) {
        return { url, error: String((e as Error).cause ?? e), ms: Date.now() - started };
      }
    }),
  );
  return NextResponse.json({ region: process.env.VERCEL_REGION ?? null, results });
}
