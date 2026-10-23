import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { env } from "@/lib/env";
import { detectKind, findPeriodInGrid, mergeTables, parseLines, parseSummary } from "@/lib/cats-payroll";
import type { Database, Json } from "@/lib/supabase/types";

/**
 * POST /api/sync/payroll · listëpagesat nga një faqe e kapur në e-Filing (cis-client-2 / TUFA Sync).
 *
 * Autorizimi: `Authorization: Bearer tba_...` (çelësi i subjektit, me të drejtën "sync:payroll").
 * Trupi: { nipt, url?, tables: string[][][], year?, month? } — tabelat ashtu siç u kapën.
 * TUFA njeh vetë faqen ("Listëpagesa të Dorëzuara" ose "Shfaq Detajet") dhe i lexon vlerat;
 * NIPT-i i faqes duhet të jetë i subjektit të çelësit (kontrollohet në DB).
 * Përgjigja: { ok, kind, rows, ...rezultati i importit }
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_RE = /^tba_[0-9a-f]{48}$/;
const cell = z.string().max(2000);
const bodySchema = z.object({
  nipt: z.string().regex(/^[A-Za-z]\d{8}[A-Za-z]$/, "NIPT i pavlefshëm"),
  url: z.string().url().max(2000).optional(),
  tables: z.array(z.array(z.array(cell).max(80)).max(5000)).min(1).max(40),
  year: z.number().int().min(2000).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
});

function db() {
  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!KEY_RE.test(key)) {
    return NextResponse.json({ ok: false, error: "Çelës API i pavlefshëm ose i revokuar" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Trupi duhet të jetë JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Trup i pavlefshëm" }, { status: 400 });
  }
  if (parsed.data.url && !/^https:\/\/efiling\.tatime\.gov\.al\//.test(parsed.data.url)) {
    return NextResponse.json({ ok: false, error: "Faqja nuk është nga e-Filing (efiling.tatime.gov.al)" }, { status: 400 });
  }

  const grid = mergeTables(parsed.data.tables);
  const kind = detectKind(grid);
  let rows: unknown[];
  let year: number | null = null;
  let month: number | null = null;
  if (kind === "summary") {
    rows = parseSummary(grid);
  } else if (kind === "lines") {
    rows = parseLines(grid);
    const p = parsed.data.year && parsed.data.month ? { year: parsed.data.year, month: parsed.data.month } : findPeriodInGrid(grid);
    if (!p) return NextResponse.json({ ok: false, error: "Muaji i listëpagesës nuk u gjet në faqe; dërgoje me year/month." }, { status: 400 });
    ({ year, month } = p);
  } else {
    return NextResponse.json({ ok: false, error: "Faqja nuk është “Listëpagesa të Dorëzuara” ose “Shfaq Detajet” e një listëpagese." }, { status: 422 });
  }
  if (rows.length === 0) return NextResponse.json({ ok: false, error: "Faqja u njoh, por nuk u gjet asnjë rresht." }, { status: 422 });

  const { data, error } = await db().rpc("sync_payroll", {
    p_key: key,
    p_nipt: parsed.data.nipt,
    p_kind: kind,
    p_year: year as number, // null për përmbledhjen (SQL e pranon)
    p_month: month as number,
    p_rows: rows as Json,
  });
  if (error) {
    const status = error.code === "28000" ? 401 : error.code === "22023" ? 400 : 500;
    return NextResponse.json({ ok: false, error: error.message }, { status });
  }
  return NextResponse.json({ ok: true, kind, rows: rows.length, ...(year ? { year, month } : {}), ...((data ?? {}) as Record<string, unknown>) });
}
