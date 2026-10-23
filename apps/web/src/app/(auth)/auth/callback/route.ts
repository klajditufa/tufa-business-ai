import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Callback për linkun e konfirmimit të email-it / magic link (PKCE). */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";
  // Vetëm rrugë të brendshme: "//host" ose "/\\host" do të çonin jashtë TUFA.
  const safeNext = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
