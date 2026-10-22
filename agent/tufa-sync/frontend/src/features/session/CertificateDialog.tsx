import { Alert, Badge, Button, Group, Modal, Stack } from "@mantine/core";
import { IconAlertTriangle, IconArrowsExchange, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { api } from "../../api";
import { Code, EnvironmentBadge, ErrorBox, Facts } from "../../components/ui";
import { useI18n } from "../../i18n";
import { formatDate } from "../../lib/format";
import type { Business, Session } from "../../types";
import { businessName } from "./context";

/** What the certificate says, whether CIS accepted it, and switching environment or removing it. */
export function CertificateDialog({
  business,
  onSession,
  onClose,
}: {
  business: Business;
  onSession: (session: Session) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<"switch" | "remove" | null>(null);
  const [error, setError] = useState<unknown>(null);
  const cert = business.certificate;
  const other = business.environment === "production" ? "test" : "production";

  async function change(action: "switch" | "remove", request: () => Promise<Session>) {
    setBusy(action);
    setError(null);
    try {
      onSession(await request());
      onClose();
    } catch (reason) {
      setError(reason);
      setBusy(null);
    }
  }

  return (
    <Modal opened onClose={onClose} title={businessName(business)} size="lg">
      <Stack gap="lg">
        <Facts
          cols={{ base: 1, xs: 2 }}
          entries={[
            [t("cert.business"), cert.name || cert.commonName],
            [t("cert.nipt"), <Code key="nipt" value={cert.nipt} />],
            [t("cert.environment"), <EnvironmentBadge key="env" environment={business.environment} />],
            [
              t("cert.status"),
              business.verified ? (
                <Badge key="status" color="teal">
                  {t("cert.verified")}
                </Badge>
              ) : (
                <Badge key="status" color="yellow">
                  {t("cert.unverified")}
                </Badge>
              ),
            ],
            [
              t("cert.validity"),
              <Group key="validity" gap="xs">
                {formatDate(cert.validFrom, false)} – {formatDate(cert.validTo, false)}
                {cert.expired && <Badge color="red">{t("cert.expired")}</Badge>}
              </Group>,
            ],
            [t("cert.issuer"), cert.issuer],
            [t("cert.serial"), <Code key="serial" value={cert.serialNumber} />],
            [t("cert.fingerprint"), <Code key="fingerprint" value={cert.fingerprintSha256} />],
          ]}
        />
        {business.warning && (
          <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
            {business.warning}
          </Alert>
        )}
        {error !== null && <ErrorBox error={error} />}
        <Group justify="space-between">
          <Button
            variant="default"
            leftSection={<IconArrowsExchange size={16} />}
            loading={busy === "switch"}
            disabled={busy !== null}
            onClick={() =>
              void change("switch", () =>
                api<Session>("/api/session/environment", { environment: other }, { business: business.id }),
              )
            }
          >
            {t("cert.switch", { env: t(`env.${other}`) })}
          </Button>
          <Button
            color="red"
            variant="light"
            leftSection={<IconTrash size={16} />}
            loading={busy === "remove"}
            disabled={busy !== null}
            onClick={() =>
              void change("remove", () =>
                api<Session>("/api/session", undefined, { method: "DELETE", business: business.id }),
              )
            }
          >
            {t("cert.unload")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
