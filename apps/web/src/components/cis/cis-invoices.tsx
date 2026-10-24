"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import { IconCertificate, IconReceipt2 } from "@tabler/icons-react";
import { I18nProvider } from "@/cis/i18n";
import { InvoicesView } from "@/cis/features/invoices/InvoicesView";
import { BusinessContext, TufaCisContext } from "@/cis/features/session/context";
import type { CertificateBusiness, Kind } from "@/cis/types";
import { useCis } from "./cis-provider";

/**
 * Shitjet / Blerjet me modulin e faturave të cis-client-2 (periudha, NIVF, detajet, artikujt, CSV/JSON/PDF).
 * Me certifikatën në shfletues "Merr faturat" lexon nga CIS dhe i ruan në TUFA; pa të, shfaq ato që janë në TUFA.
 */
export function CisInvoices({ kind, paymentsHref }: { kind: Kind; paymentsHref: string }) {
  const { company, certificate, session, openDialog, ready } = useCis();
  const [cisMissing, setCisMissing] = useState(false);
  const business = useMemo<CertificateBusiness>(
    () => ({
      id: company.id,
      nipt: company.nipt,
      name: company.name,
      verified: true,
      warning: null,
      filing: { configured: false, remembered: false, connected: false },
      hasCertificate: true,
      environment: certificate?.info.environment ?? "production",
      certificate: certificate
        ? {
            nipt: certificate.info.nipt,
            name: certificate.info.name,
            commonName: certificate.info.commonName,
            issuer: certificate.info.issuer,
            serialNumber: certificate.info.serialNumber,
            validFrom: certificate.info.validFrom,
            validTo: certificate.info.validTo,
            expired: certificate.info.expired,
            fingerprintSha256: certificate.info.fingerprintSha256,
          }
        : { nipt: company.nipt, name: company.name },
    }),
    [company, certificate],
  );
  const tufa = useMemo(() => ({ companyId: company.id, nipt: company.nipt, session, onCisMissing: () => setCisMissing(true) }), [company, session]);
  if (!ready) return null;

  return (
    <I18nProvider>
      <BusinessContext.Provider value={business}>
        <TufaCisContext.Provider value={tufa}>
          <Stack gap="md">
            {!session && (
              <Alert color={cisMissing ? "yellow" : "blue"} variant="light" icon={<IconCertificate size={18} />}>
                <Group justify="space-between" gap="sm">
                  <Text size="sm">
                    {cisMissing
                      ? "Artikujt dhe PDF-ja zyrtare merren nga fiskalizimi: shto certifikatën e subjektit në këtë shfletues."
                      : "Pa certifikatë CIS në këtë shfletues: shfaqen faturat që janë në TUFA. Me certifikatën, “Merr faturat” i merr nga fiskalizimi."}
                  </Text>
                  <Button size="xs" variant="light" leftSection={<IconCertificate size={14} />} onClick={() => openDialog()}>
                    Shto certifikatën CIS
                  </Button>
                </Group>
              </Alert>
            )}
            <InvoicesView
              key={session ? "cis" : "db"}
              kind={kind}
              actions={
                <Button component={Link} href={paymentsHref} variant="default" leftSection={<IconReceipt2 size={16} />}>
                  Pagesat
                </Button>
              }
            />
          </Stack>
        </TufaCisContext.Provider>
      </BusinessContext.Provider>
    </I18nProvider>
  );
}
