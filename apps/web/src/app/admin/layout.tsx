import { notFound } from "next/navigation";
import { Container, Stack, Text } from "@mantine/core";
import { getProfile, listMyCompanies } from "@/server/services/companies";
import { Header } from "@/components/app/header";

/** Administrimi i platformës: vetëm për super admin (të tjerët marrin 404). E njëjta kokë si në aplikacion. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [profile, companies] = await Promise.all([getProfile(), listMyCompanies()]);
  if (!profile || !("is_super_admin" in profile) || !profile.is_super_admin) notFound();
  const current = companies.find((c) => c.id === profile.last_company_id) ?? companies[0];
  return (
    <div className="min-h-screen">
      <Header company={current} companies={companies} userName={profile.full_name || profile.email || ""} role="accountant" isSuperAdmin />
      <Container size={1440} px={{ base: "xs", sm: "md" }} pt="lg" pb="xl">
        <Stack gap="lg">
          <Text size="sm" c="dimmed">
            Administrimi i platformës
          </Text>
          <main>{children}</main>
        </Stack>
      </Container>
    </div>
  );
}
