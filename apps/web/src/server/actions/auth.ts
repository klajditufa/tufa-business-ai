"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; field?: string };

const loginSchema = z.object({
  email: z.string().email("Email i pavlefshëm"),
  password: z.string().min(8, "Të paktën 8 karaktere"),
  next: z.string().optional(),
});

const registerSchema = loginSchema.extend({
  fullName: z.string().min(2, "Shkruaj emrin e plotë").max(120),
});

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue.message, field: String(issue.path[0]) };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { ok: false, error: "Email ose fjalëkalim i gabuar." };

  const next = parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : "/app";
  redirect(next);
}

export async function registerAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue.message, field: String(issue.path[0]) };
  }
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
    },
  });
  if (error) return { ok: false, error: error.message };

  // Nëse konfirmimi i email-it është i çaktivizuar (dev), sesioni ekziston → vazhdo
  if (data.session) redirect("/onboarding");
  return { ok: true, message: "Kontrollo email-in për linkun e konfirmimit." };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
