import { Suspense } from "react";
import { Badge, Container, Group, Stack, Text } from "@mantine/core";
import { notFound } from "next/navigation";
import { getCompany, getMyRole, getProfile, listMyCompanies } from "@/server/services/companies";
import { getSyncStatus } from "@/server/services/invoices";
import { Header } from "@/components/app/header";
import { CisProvider } from "@/components/cis/cis-provider";
import { CisStatus } from "@/components/cis/cis-status";
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
    <CisProvider company={{ id: company.id, nipt: company.nipt, name: company.trade_name || company.legal_name }}>
    <div className="min-h-screen">
      <Header company={company} companies={companies} userName={profile?.full_name || profile?.email || ""} role={role} isSuperAdmin={isSuperAdmin} />
      <Container size={1440} px={{ base: "xs", sm: "md" }} pt="lg" pb="xl">
        <Stack gap="lg">
          <Group justify="space-between" gap="xs">
            <Text size="sm" c="dimmed" ff="monospace">
              {company.nipt}
            </Text>
            <Group gap="xs">
              {sync?.last_sync_at && (
                <Badge variant="light" color="gray" title={`${sync.sales_count} shitje, ${sync.purchases_count} blerje`}>
                  Sinkronizuar · {date(sync.last_sync_at)}
                </Badge>
              )}
              <CisStatus />
            </Group>
          </Group>
          <Suspense fallback={<div className="h-11" />}>
            <CompanyTabs companyId={companyId} studioCount={studio ? companies.length : null} />
          </Suspense>
          <main>{children}</main>
        </Stack>
        <Text size="xs" c="dimmed" mt={48}>
          Hapësirë online · Faturat vijnë nga fiskalizimi (CIS) me certifikatën që mbetet te subjekti; deklaratat dhe listëpagesat nga
          C@TS. Deklarimi dhe pagesa bëhen në portalin zyrtar.
        </Text>
      </Container>
    </div>
    </CisProvider>
  );
}
