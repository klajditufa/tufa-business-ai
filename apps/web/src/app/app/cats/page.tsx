import { redirect } from "next/navigation";
import { Container, Paper, Stack, Text, Title } from "@mantine/core";
import { listMyCompanies } from "@/server/services/companies";

/**
 * Hyrja nga shtesa "TUFA · e-Filing": gjen subjektin me NIPT-in e faqes së e-Filing ndër subjektet e
 * përdoruesit dhe e çon te Listëpagesa me id-në e kapjes. Kapja vetë mbetet në shtesë deri sa ta kërkojë faqja.
 */
export default async function CatsEntry({ searchParams }: { searchParams: Promise<{ nipt?: string; capture?: string }> }) {
  const { nipt = "", capture = "" } = await searchParams;
  const validNipt = /^[A-Z]\d{8}[A-Z]$/.test(nipt.toUpperCase());
  const validCapture = /^[0-9a-f-]{36}$/.test(capture);
  const companies = validNipt ? await listMyCompanies() : [];
  const company = companies.find((c) => String(c.nipt).toUpperCase() === nipt.toUpperCase());
  if (company && validCapture) redirect(`/app/${company.id}/payroll?capture=${capture}`);
  return (
    <Container size={560} py={64}>
      <Paper p="xl">
        <Stack gap="sm">
          <Title order={3}>Faqja e e-Filing nuk u importua</Title>
          <Text c="dimmed">
            {!validNipt || !validCapture
              ? "Lidhja nga shtesa është e paplotë. Provo sërish nga e-Filing."
              : `Subjekti me NIPT ${nipt.toUpperCase()} nuk është ndër subjektet e tua në TUFA. Shtoje te Paneli i studios → Subjektet, pastaj dërgoje sërish faqen.`}
          </Text>
        </Stack>
      </Paper>
    </Container>
  );
}
