import { Badge, ColorSwatch, Group, Menu, Modal, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconCertificate, IconCheck, IconChevronDown, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { api } from "../../api";
import { EnvironmentBadge } from "../../components/ui";
import { useI18n } from "../../i18n";
import type { Business, Session } from "../../types";
import { CertificateDialog } from "./CertificateDialog";
import { businessName, useSession } from "./context";
import { SetupForm } from "./SetupForm";

/** The business the page shows, the other loaded ones, adding another and the certificate's details. */
export function BusinessSwitcher() {
  const { t } = useI18n();
  const { session, setSession } = useSession();
  const [dialog, setDialog] = useState<"add" | "details" | null>(null);
  const active: Business | undefined =
    session.businesses.find((business) => business.id === session.active) ?? session.businesses.at(0);
  if (!active) return null;

  const select = (business: Business) => {
    setSession({ ...session, active: business.id });
    api<Session>("/api/session/active", { id: business.id }).then(setSession, () => {});
  };

  return (
    <>
      <Menu width={360}>
        <Menu.Target>
          <UnstyledButton
            px="sm"
            h={38}
            miw={0}
            maw={420}
            style={{
              border: "1px solid var(--mantine-color-default-border)",
              borderRadius: "var(--mantine-radius-xl)",
            }}
          >
            <Group gap={8} wrap="nowrap">
              <Group visibleFrom="sm">
                <EnvironmentBadge environment={active.environment} />
              </Group>
              <ColorSwatch
                hiddenFrom="sm"
                size={10}
                withShadow={false}
                color={`var(--mantine-color-${active.environment === "production" ? "teal" : "yellow"}-6)`}
                style={{ flex: "none" }}
              />
              <Text size="sm" fw={600} truncate>
                {businessName(active)}
              </Text>
              {active.certificate.nipt && (
                <Text size="xs" c="dimmed" ff="monospace" visibleFrom="sm">
                  {active.certificate.nipt}
                </Text>
              )}
              {active.certificate.expired && <Badge color="red">{t("cert.expired")}</Badge>}
              <IconChevronDown size={14} stroke={1.8} style={{ flex: "none" }} />
            </Group>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>
            {t("biz.switch")} · {t("biz.count", { n: session.businesses.length })}
          </Menu.Label>
          {session.businesses.map((business) => (
            <Menu.Item
              key={business.id}
              leftSection={
                business.id === active.id ? (
                  <IconCheck size={16} color="var(--mantine-color-teal-6)" />
                ) : (
                  <IconCertificate size={16} />
                )
              }
              onClick={() => select(business)}
            >
              <Stack gap={0}>
                <Text size="sm" fw={600}>
                  {businessName(business)}
                </Text>
                <Text size="xs" c="dimmed">
                  {[business.certificate.nipt, t(`env.${business.environment}`)].filter(Boolean).join(" · ")}
                </Text>
              </Stack>
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item leftSection={<IconPlus size={16} />} onClick={() => setDialog("add")}>
            {t("biz.add")}
          </Menu.Item>
          <Menu.Item leftSection={<IconCertificate size={16} />} onClick={() => setDialog("details")}>
            {t("biz.details")}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Modal opened={dialog === "add"} onClose={() => setDialog(null)} title={t("biz.add")} size="lg">
        <Stack gap="md">
          <Text c="dimmed" size="sm">
            {t("biz.addLead")}
          </Text>
          <SetupForm
            onLoaded={(next) => {
              setSession(next);
              setDialog(null);
            }}
          />
        </Stack>
      </Modal>
      {dialog === "details" && (
        <CertificateDialog business={active} onSession={setSession} onClose={() => setDialog(null)} />
      )}
    </>
  );
}
