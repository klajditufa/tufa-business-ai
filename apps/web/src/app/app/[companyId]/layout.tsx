import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany, getMyRole, getProfile, listMyCompanies } from "@/server/services/companies";
import { getSyncStatus } from "@/server/services/invoices";
import { Header } from "@/components/app/header";
import { CompanyTabs } from "@/components/app/company-tabs";
import { createClient } from "@/lib/supabase/server";
import { date } from "@/lib/format";

/**
 * Layout-i i subjektit aktiv (pamja e cis-client-2): koka, rreshti NIPT + statusi i fiskalizimit, skedat.
 * Verifikon aksesin me RLS: nëse kompania nuk kthehet, 404 (jo 403, që të mos zbulojmë ekzistencën e subjektit).
 * Ruan last_company_id që /app të kthehet këtu herën tjetër.
 */
export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const [company, companies, profile, role, sync] = await Promise.all([
    getCompany(companyId),
    listMyCompanies(),
    getProfile(),
    getMyRole(companyId),
    getSyncStatus(companyId),
  ]);
  if (!company) notFound();

  if (profile && profile.last_company_id !== companyId) {
    const supabase = await createClient();
    await supabase.from("users").update({ last_company_id: companyId }).eq("id", profile.id);
  }
  const isSuperAdmin = !!(profile && "is_super_admin" in profile && profile.is_super_admin);
  const studio = role === "org_owner" || role === "accountant" || isSuperAdmin;

  return (
    <div className="min-h-screen">
      <Header company={company} companies={companies} userName={profile?.full_name || profile?.email || ""} role={role} isSuperAdmin={isSuperAdmin} />
      <div className="mx-auto max-w-[1440px] px-4 pt-5 sm:px-6 lg:px-9">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-sm text-muted-foreground">{company.nipt}</span>
          {sync?.last_sync_at ? (
            <span className="rounded-md bg-success/15 px-2 py-0.5 text-xs font-semibold text-success" title={`${sync.sales_count} shitje, ${sync.purchases_count} blerje`}>
              Fiskalizimi i lidhur · {date(sync.last_sync_at)}
            </span>
          ) : (
            <Link href={`/app/${companyId}/settings#sync`} className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
              Pa lidhje me fiskalizimin
            </Link>
          )}
        </div>
        <Suspense fallback={<div className="h-11 border-b border-border" />}>
          <CompanyTabs companyId={companyId} studioCount={studio ? companies.length : null} />
        </Suspense>
      </div>
      <main className="mx-auto max-w-[1440px] px-4 pb-12 pt-6 sm:px-6 lg:px-9">{children}</main>
      <footer className="mx-auto max-w-[1440px] px-4 pb-8 text-xs text-muted-foreground sm:px-6 lg:px-9">
        Faturat vijnë nga fiskalizimi (CIS) me certifikatën që mbetet te subjekti; deklaratat dhe listëpagesat nga C@TS. Deklarimi dhe pagesa bëhen në portalin zyrtar.
      </footer>
    </div>
  );
}
