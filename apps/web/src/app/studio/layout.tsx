import { redirect } from "next/navigation";
import { Container, Stack, Text } from "@mantine/core";
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
      <Container size={1440} px={{ base: "xs", sm: "md" }} pt="lg" pb="xl">
        <Stack gap="lg">
          <Text size="sm" c="dimmed">
            Paneli i studios · {companies.length} subjekte
          </Text>
          <StudioTabs />
          <main>{children}</main>
        </Stack>
      </Container>
    </div>
  );
}
