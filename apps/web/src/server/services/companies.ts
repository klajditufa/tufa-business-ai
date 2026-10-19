import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

export type Company = Tables<"companies">;

/** Kompanitë që sheh përdoruesi (RLS vendos). */
export async function listMyCompanies(): Promise<Company[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .is("deleted_at", null)
    .order("legal_name");
  if (error) throw error;
  return data ?? [];
}

/** Një kompani sipas id — null nëse RLS nuk e kthen (nuk ka akses). */
export async function getCompany(companyId: string): Promise<Company | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("*").eq("id", companyId).maybeSingle();
  return data;
}

/** Roli efektiv i përdoruesit në kompani (thërret funksionin SQL). */
export async function getMyRole(companyId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_company_role", { p_company_id: companyId });
  return (data as string | null) ?? null;
}

export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
  return data ?? { id: user.id, email: user.email ?? "", full_name: "", locale: "sq", last_company_id: null };
}
