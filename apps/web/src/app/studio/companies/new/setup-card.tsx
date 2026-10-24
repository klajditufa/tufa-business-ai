"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Anchor, Center, Paper, Stack, Text, Title } from "@mantine/core";
import { I18nProvider, useI18n } from "@/cis/i18n";
import { SetupForm } from "@/cis/features/session/SetupForm";

/** "Shtoni një subjekt" i cis-client-2 (App → Setup): me certifikatë ose vetëm e-Filing. */
export function SetupCard() {
  return (
    <I18nProvider>
      <Setup />
    </I18nProvider>
  );
}

function Setup() {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <Center pt="6vh">
      <Paper p="xl" w="100%" maw={560} shadow="sm">
        <Stack gap="lg">
          <div>
            <Title order={2}>{t("setup.chooseTitle")}</Title>
            <Text c="dimmed" mt={6}>
              {t("setup.chooseLead")}
            </Text>
          </div>
          <SetupForm
            onLoaded={({ company, mode }) =>
              router.push(mode === "certificate" ? `/app/${company.id}/invoices?direction=sale` : `/app/${company.id}/filing`)
            }
          />
          <Text size="xs" c="dimmed" pt="md" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
            Certifikata hapet në këtë kompjuter: çelësi privat ruhet në shfletues si çelës që nuk eksportohet dhe nuk dërgohet as te TUFA; kërkesat
            nënshkruhen këtu dhe vetëm pjesa publike e certifikatës shkon me to te tatimet. Të dhënat e e-Albania mbeten vetëm në këtë shfletues.
          </Text>
          <Text size="xs" c="dimmed">
            Pa certifikatë dhe pa e-Filing?{" "}
            <Anchor component={Link} href="/studio/companies/new?manual=1" size="xs">
              Plotësoni të dhënat e QKB me dorë
            </Anchor>
            .
          </Text>
        </Stack>
      </Paper>
    </Center>
  );
}
