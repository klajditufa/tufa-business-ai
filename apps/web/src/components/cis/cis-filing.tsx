"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Group, Text } from "@mantine/core";
import { IconWallet } from "@tabler/icons-react";
import { I18nProvider, useI18n } from "@/cis/i18n";
import { FilingView } from "@/cis/features/filing/FilingView";
import type { PortalSnapshot } from "@/cis/features/filing/types";
import { BusinessContext } from "@/cis/features/session/context";
import type { Business } from "@/cis/types";
import { detectKind, mergeTables } from "@/lib/cats-payroll";
import { handOff } from "@/lib/filing/handoff";
import { useCis } from "./cis-provider";

/** Skeda e-Filing = FilingView i cis-client-2, me lidhjen përmes shtesës "TUFA · e-Filing". */
export function CisFiling() {
  const { company, certificate, filing, ready } = useCis();
  const business = useMemo<Business>(
    () => ({
      id: company.id,
      nipt: company.nipt,
      name: company.name,
      verified: true,
      warning: null,
      filing: { configured: filing.configured, remembered: filing.remembered, connected: false },
      hasCertificate: false,
      environment: null,
      certificate: null,
    }),
    [company, filing.configured, filing.remembered],
  );
  void certificate;
  if (!ready) return null;
  return (
    <I18nProvider>
      <BusinessContext.Provider value={business}>
        <FilingView extra={(snapshot) => <PayrollHandoff companyId={company.id} snapshot={snapshot} />} />
      </BusinessContext.Provider>
    </I18nProvider>
  );
}

/** Kur faqja e portalit është listëpagesë (lista e dorëzuar ose E-SIG 025), kalon te Listëpagesa e TUFA. */
function PayrollHandoff({ companyId, snapshot }: { companyId: string; snapshot: PortalSnapshot }) {
  const { t } = useI18n();
  const router = useRouter();
  const kind = useMemo(() => {
    try {
      return detectKind(mergeTables(snapshot.tables));
    } catch {
      return null;
    }
  }, [snapshot]);
  if (kind !== "summary" && kind !== "lines") return null;
  return (
    <Alert color="teal" variant="light">
      <Group justify="space-between" gap="sm">
        <Text size="sm">{t("filing.payrollDetected")}</Text>
        <Button
          size="xs"
          leftSection={<IconWallet size={14} />}
          onClick={() => {
            handOff(companyId, { url: snapshot.url, title: snapshot.title, nipt: snapshot.nipt, tables: snapshot.tables, capturedAt: snapshot.capturedAt * 1000 });
            router.push(`/app/${companyId}/payroll?from=efiling`);
          }}
        >
          {t("filing.openPayroll")}
        </Button>
      </Group>
    </Alert>
  );
}
