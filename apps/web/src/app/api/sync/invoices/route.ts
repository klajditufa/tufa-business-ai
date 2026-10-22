import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { env } from "@/lib/env";
import type { Database, Json } from "@/lib/supabase/types";

/**
 * /api/sync/invoices · pika hyrëse e agjentit lokal "TUFA Sync".
 *
 * Autorizimi: `Authorization: Bearer tba_...` (çelës API për subjekt, krijuar te Cilësimet).
 * Çelësi verifikohet me hash brenda DB-së (sync_check_key / sync_cis_invoices, SECURITY DEFINER).
 * Nuk përdoret service_role: route-i thërret DB-në me çelësin publik, pa sesion.
 * Certifikata e fiskalizimit nuk vjen kurrë këtu — vetëm faturat.
 *
 * GET  → { ok, company: { id, nipt, legal_name } }       (kontroll i çelësit)
 * POST { direction, invoices: [CIS Inv], label? } → { ok, company_id, batch_id, imported, updated, skipped, errors }
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_RE = /^tba_[0-9a-f]{48}$/;

const bodySchema = z.object({
  direction: z.enum(["sale", "purchase"]),
  invoices: z.array(z.record(z.string(), z.unknown())).max(2000),
  label: z.string().max(120).optional(),
});

function db() {
  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearer(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return KEY_RE.test(key) ? key : null;
}

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Çelës API i pavlefshëm ose i revokuar" },
    { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
  );
}

export async function GET(request: NextRequest) {
  const key = bearer(request);
  if (!key) return unauthorized();
  const { data, error } = await db().rpc("sync_check_key", { p_key: key });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const company = data?.[0];
  if (!company) return unauthorized();
  return NextResponse.json({ ok: true, company: { id: company.company_id, nipt: company.nipt, legal_name: company.legal_name } });
}

export async function POST(request: NextRequest) {
  const key = bearer(request);
  if (!key) return unauthorized();

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Trupi duhet të jetë JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Trup i pavlefshëm", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  }

  const { data, error } = await db().rpc("sync_cis_invoices", {
    p_key: key,
    p_direction: parsed.data.direction,
    p_invoices: parsed.data.invoices as Json,
    p_label: parsed.data.label,
  });
  if (error) {
    const status = error.code === "28000" ? 401 : error.code === "22023" ? 400 : 500;
    return NextResponse.json({ ok: false, error: error.message }, { status });
  }
  return NextResponse.json({ ok: true, ...((data ?? {}) as Record<string, unknown>) });
}
