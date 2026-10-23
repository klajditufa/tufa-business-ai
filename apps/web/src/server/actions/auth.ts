"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/** Vetëm rrugë të brendshme ("/app/..."); "//host" ose "/\\host" do të çonin jashtë TUFA. */
function safeNext(next: string | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return null;
  return next.slice(0, 1000);
}

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

  const next = safeNext(parsed.data.next) ?? "/app";
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
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext(parsed.data.next) ?? "/onboarding")}`,
    },
  });
  if (error) return { ok: false, error: error.message };

  // Nëse konfirmimi i email-it është i çaktivizuar (dev), sesioni ekziston → vazhdo
  if (data.session) redirect(safeNext(parsed.data.next) ?? "/onboarding");
  return { ok: true, message: "Kontrollo email-in për linkun e konfirmimit." };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const emailSchema = z.object({ email: z.string().email("Email i pavlefshëm") });

export async function forgotPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message, field: "email" };
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  // Linku i email-it kalon nga /auth/callback (PKCE) dhe përfundon te /reset-password
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error) return { ok: false, error: error.message };
  // Mesazh i njëjtë pavarësisht nëse email-i ekziston (nuk zbulojmë llogaritë)
  return { ok: true, message: "Nëse ky email ka llogari, do të marrësh një link për rivendosjen e fjalëkalimit." };
}

const newPasswordSchema = z
  .object({
    password: z.string().min(8, "Të paktën 8 karaktere"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Fjalëkalimet nuk përputhen", path: ["confirm"] });

export async function resetPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue.message, field: String(issue.path[0]) };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Linku ka skaduar. Kërko një link të ri." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: error.message };
  redirect("/app");
}
