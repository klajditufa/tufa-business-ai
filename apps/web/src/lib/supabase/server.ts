import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Klienti Supabase për Server Components / Server Actions / Route Handlers.
 * Përdor gjithmonë çelësin publik + sesionin e përdoruesit → RLS është aktive.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Thirrur nga një Server Component: cookies vendosen nga proxy.ts
        }
      },
    },
  });
}
