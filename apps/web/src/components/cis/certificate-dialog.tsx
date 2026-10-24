"use client";

import { Modal, Stack, Text } from "@mantine/core";
import { I18nProvider, useI18n } from "@/cis/i18n";
import { SetupForm } from "@/cis/features/session/SetupForm";
import { useCis } from "./cis-provider";

export type SetupMode = "certificate" | "filing";

/** AddCertificateButton i cis-client-2: SetupForm me `attachTo` = subjekti aktiv (certifikata + opsionalisht e-Albania). */
export function CertificateDialog({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <I18nProvider>
      <Dialog opened={opened} onClose={onClose} />
    </I18nProvider>
  );
}

function Dialog({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { company, setCertificate, refreshFiling } = useCis();
  return (
    <Modal opened={opened} onClose={onClose} title={t("biz.addCertificate")} size="lg">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {company.nipt}
        </Text>
        {opened && (
          <SetupForm
            attachTo={company}
            onLoaded={({ certificate }) => {
              if (certificate) setCertificate(certificate);
              refreshFiling();
              onClose();
            }}
          />
        )}
      </Stack>
    </Modal>
  );
}
