import { redirect } from "next/navigation";
import { getProfile, listMyCompanies } from "@/server/services/companies";
import { Header } from "@/components/app/header";
import { StudioTabs } from "./studio-tabs";

/** Paneli i studios: për org_owner / accountant me disa subjekte. E njëjta kokë si te subjekti. */
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const [profile, companies] = await Promise.all([getProfile(), listMyCompanies()]);
  if (companies.length === 0) redirect("/onboarding");
  const isSuperAdmin = !!(profile && "is_super_admin" in profile && profile.is_super_admin);
  const current = companies.find((c) => c.id === profile?.last_company_id);
  return (
    <div className="min-h-screen">
      <Header companies={companies} company={current} userName={profile?.full_name || profile?.email || ""} role="accountant" isSuperAdmin={isSuperAdmin} homeHref="/studio" />
      <div className="mx-auto max-w-[1440px] px-4 pt-5 sm:px-6 lg:px-9">
        <div className="mb-3 text-sm text-muted-foreground">Paneli i studios · {companies.length} subjekte</div>
        <StudioTabs />
      </div>
      <main className="mx-auto max-w-[1440px] px-4 pb-12 pt-6 sm:px-6 lg:px-9">{children}</main>
    </div>
  );
}
