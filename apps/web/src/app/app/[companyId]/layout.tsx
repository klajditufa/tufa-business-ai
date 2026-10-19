import { notFound } from "next/navigation";
import { getCompany, getMyRole, getProfile, listMyCompanies } from "@/server/services/companies";
import { Sidebar } from "@/components/app/sidebar";
import { Header } from "@/components/app/header";
import { createClient } from "@/lib/supabase/server";

/**
 * Layout-i i subjektit aktiv. Verifikon aksesin me RLS: nëse kompania nuk kthehet, 404 (jo 403, që të mos
 * zbulojmë ekzistencën e subjektit). Ruan last_company_id që /app të kthehet këtu herën tjetër.
 */
export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const [company, companies, profile, role] = await Promise.all([
    getCompany(companyId),
    listMyCompanies(),
    getProfile(),
    getMyRole(companyId),
  ]);
  if (!company) notFound();

  if (profile && profile.last_company_id !== companyId) {
    const supabase = await createClient();
    await supabase.from("users").update({ last_company_id: companyId }).eq("id", profile.id);
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar companyId={companyId} role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header company={company} companies={companies} userName={profile?.full_name || profile?.email || ""} role={role} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
