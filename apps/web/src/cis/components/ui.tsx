// Small building blocks shared by every screen, on top of Mantine's components.
import {
  ActionIcon,
  Alert,
  Badge,
  Code as MantineCode,
  CopyButton as MantineCopyButton,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconAlertCircle, IconCheck, IconCopy, IconInbox } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { ApiError } from "../api";
import { useI18n } from "../i18n";
import { HINTS_SQ } from "../i18n/strings";

/** An error from the API (with CIS's code and a hint when there is one) or any other error. */
export function ErrorBox({ error }: { error: unknown }) {
  const { lang, t } = useI18n();
  const payload = error instanceof ApiError ? error.payload : {};
  const cis = payload.cisError;
  const faultCode = cis?.faultCode ?? undefined;
  const hint =
    (lang === "sq" &&
      ((faultCode && HINTS_SQ[faultCode]) || (payload.unreachable && HINTS_SQ.unreachable))) ||
    payload.hint;
  const message = payload.offline
    ? t("error.network")
    : cis?.faultString || payload.message || (error instanceof Error ? error.message : String(error));
  return (
    <Alert
      color="red"
      variant="light"
      icon={<IconAlertCircle size={18} />}
      title={
        <Group gap="xs">
          {message}
          {faultCode && (
            <Badge color="red" variant="outline" size="sm">
              {t("error.code", { code: faultCode })}
            </Badge>
          )}
        </Group>
      }
    >
      {hint}
    </Alert>
  );
}

/** Nothing to show yet (or nothing found): a quiet box with a sentence. */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <Paper p={{ base: "lg", sm: "xl" }} style={{ borderStyle: "dashed" }} bg="transparent">
      <Group justify="center" gap="xs" c="dimmed">
        <IconInbox size={18} stroke={1.6} />
        <Text c="dimmed" ta="center">
          {children}
        </Text>
      </Group>
    </Paper>
  );
}

export function Code({ value }: { value?: string | null }) {
  return value ? (
    <MantineCode fz="sm" bg="transparent" p={0} className="code-value">
      {value}
    </MantineCode>
  ) : null;
}

/** An icon button that copies `value`; it confirms with a check mark. */
export function CopyIcon({ value, label }: { value: string; label?: string }) {
  const { t } = useI18n();
  return (
    <MantineCopyButton value={value} timeout={1400}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? t("common.copied") : (label ?? t("common.copy"))}>
          <ActionIcon
            size="sm"
            color={copied ? "teal" : "gray"}
            aria-label={label ?? t("common.copy")}
            onClick={(event) => {
              event.stopPropagation();
              copy();
            }}
          >
            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          </ActionIcon>
        </Tooltip>
      )}
    </MantineCopyButton>
  );
}

/** A code with its copy button, on one line. */
export function Copyable({ value }: { value?: string | null }) {
  if (!value) return null;
  return (
    <Group gap={4} wrap="nowrap">
      <Code value={value} />
      <CopyIcon value={value} />
    </Group>
  );
}

export type Fact = [label: string, value: ReactNode];

/** Label / value pairs in a responsive grid; empty values are left out. */
export function Facts({ entries, cols = { base: 1, xs: 2, md: 4 } }: { entries: Fact[]; cols?: object }) {
  const shown = entries.filter(
    ([, value]) => value !== null && value !== undefined && value !== "" && value !== false,
  );
  return (
    <SimpleGrid cols={cols} spacing="lg" verticalSpacing="md">
      {shown.map(([label, value]) => (
        <Stack key={label} gap={2}>
          <Text size="xs" fw={600} c="dimmed">
            {label}
          </Text>
          <Text component="div" size="sm">
            {value}
          </Text>
        </Stack>
      ))}
    </SimpleGrid>
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  const { t } = useI18n();
  return <Badge color={active ? "teal" : "gray"}>{t(active ? "status.active" : "status.inactive")}</Badge>;
}

export function EnvironmentBadge({ environment }: { environment: "production" | "test" | null }) {
  const { t } = useI18n();
  return (
    <Badge
      color={environment === null ? "gray" : environment === "production" ? "teal" : "yellow"}
      variant="light"
      tt="uppercase"
      fw={700}
      size="sm"
    >
      {t(environment ? `env.${environment}` : "setup.filingOnly")}
    </Badge>
  );
}
