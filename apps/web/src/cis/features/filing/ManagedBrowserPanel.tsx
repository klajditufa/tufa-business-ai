// ManagedBrowserPanel i cis-client-2; në TUFA gjendja vjen nga shtesa (shih useFilingState).
import { Alert, Badge, Button, Group, Loader, PasswordInput, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { maybeKey, useI18n } from "../../i18n";
import type { BrowserState, PortalSnapshot } from "./types";

export function ManagedBrowserPanel({
  state,
  snapshot,
  configured,
  unavailable,
  disabled,
  onAction,
}: {
  state: BrowserState | null;
  snapshot: PortalSnapshot | null;
  configured: boolean;
  unavailable: boolean;
  disabled: boolean;
  onAction: (kind: "start" | "verify", body: unknown) => Promise<void>;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  async function action(kind: "start" | "verify") {
    setBusy(true);
    try {
      const body = kind === "verify" ? { code } : {};
      if (kind === "verify") setCode("");
      await onAction(kind, body);
    } finally {
      setBusy(false);
    }
  }
  const errorKey = state?.error ? maybeKey(`filing.managedError.${state.error}`) : undefined;
  if (unavailable)
    return (
      <Text size="sm" c="dimmed" role="status">
        {t("filing.statusUnavailable")}
      </Text>
    );
  return (
    <Stack gap="sm">
      {errorKey && <Alert color="yellow">{t(errorKey)}</Alert>}
      {!state ? (
        <Loader size="sm" />
      ) : (
        <>
          {(state.running || state.authentication) &&
            (state.authentication === "authenticated" ? (
              <Stack gap={4} role="status" aria-live="polite">
                <Group gap="xs">
                  <Badge color="teal">C@ts</Badge>
                  <Text size="sm" fw={600}>
                    {t("filing.auth.authenticated")}
                  </Text>
                </Group>
                <Text size="sm" c="dimmed">
                  {snapshot
                    ? t("filing.pageReady", { tables: snapshot.tables.length, forms: snapshot.forms.length })
                    : t("filing.readingPage")}
                </Text>
              </Stack>
            ) : (
              <Alert color={state.running ? "blue" : "yellow"}>
                {t(maybeKey(`filing.auth.${state.authentication}`) ?? "filing.auth.connecting")}
              </Alert>
            ))}
          {(state.authentication === "otp" || state.authentication === "otp-wrong") && state.running && (
            <Group align="end">
              <PasswordInput
                label={t("filing.verificationCode")}
                value={code}
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={8}
                disabled={busy || disabled}
                onChange={(event) => setCode(event.currentTarget.value.replace(/[^0-9]/g, ""))}
              />
              <Button
                loading={busy}
                disabled={disabled || !/^[0-9]{4,8}$/.test(code)}
                onClick={() => void action("verify")}
              >
                {t("filing.verify")}
              </Button>
            </Group>
          )}
          {configured &&
            (!state.running || ["unavailable", "credentials", "taxpayer"].includes(state.authentication)) &&
            !state.installing &&
            !state.stopping && (
              <Button
                variant="light"
                loading={busy}
                disabled={disabled || !state.nodeAvailable}
                onClick={() => void action("start")}
              >
                {t(state.authentication ? "filing.retryConnection" : "filing.connect")}
              </Button>
            )}
          {state.installing && <Alert color="blue">{t("filing.preparingConnection")}</Alert>}
        </>
      )}
    </Stack>
  );
}
