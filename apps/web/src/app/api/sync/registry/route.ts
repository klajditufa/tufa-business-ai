import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { env } from "@/lib/env";
import type { Database, Json } from "@/lib/supabase/types";

/**
 * /api/sync/registry · agjenti TUFA Sync dërgon regjistrat e fiskalizimit të subjektit
 * (operatorët, njësitë e biznesit, pajisjet TCR) me çelësin API të subjektit.
 * Çdo dërgim zëvendëson pamjen e mëparshme për atë lloj. Fushat e panjohura hidhen në DB.
 *
 * POST { kind: "operators"|"units"|"tcrs", rows: [...] } → { ok, kind, rows }
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_RE = /^tba_[0-9a-f]{48}$/;
const bodySchema = z.object({
  kind: z.enum(["operators", "units", "tcrs"]),
  rows: z.array(z.record(z.string(), z.unknown())).max(5000),
});

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
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Trup i pavlefshëm", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });

  const db = createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.rpc("sync_cis_registry", { p_key: key, p_kind: parsed.data.kind, p_rows: parsed.data.rows as Json });
  if (error) {
    const status = error.code === "28000" ? 401 : error.code === "22023" ? 400 : 500;
    return NextResponse.json({ ok: false, error: error.message }, { status });
  }
  return NextResponse.json({ ok: true, ...((data ?? {}) as Record<string, unknown>) });
}
