import * as React from "react";
import {
  Alert as MantineAlert,
  Badge as MantineBadge,
  Checkbox as MantineCheckbox,
  Button as MantineButton,
  Group,
  Input as MantineInput,
  NativeSelect,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconAlertCircle, IconAlertTriangle, IconCircleCheck, IconInbox, IconInfoCircle, type Icon } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

/*
 * Komponentët bazë të TUFA-s mbi design system-in e cis-client-2 (Mantine + theme.ts).
 * API-ja mbetet e njëjtë me versionin e mëparshëm, që faqet ekzistuese të marrin pamjen e re pa ndryshime.
 */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export function Button({
  variant = "primary",
  size = "md",
  children,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color"> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }) {
  const variants: Record<ButtonVariant, { variant: string; color?: string }> = {
    primary: { variant: "filled" },
    secondary: { variant: "default" },
    ghost: { variant: "subtle", color: "gray" },
    danger: { variant: "filled", color: "red" },
  };
  const sizes: Record<ButtonSize, string> = { sm: "xs", md: "sm", lg: "md" };
  return (
    <MantineButton {...variants[variant]} size={sizes[size]} {...props}>
      <span className="inline-flex items-center gap-1.5">{children}</span>
    </MantineButton>
  );
}

export function Input({ className, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">) {
  return <MantineInput className={className} {...props} />;
}

export function Select({ className, children, ...props }: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">) {
  return (
    <NativeSelect className={className} {...props}>
      {children}
    </NativeSelect>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1 block text-sm font-medium", className)} {...props} />;
}

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Paper className={cn("p-5", className)} {...props}>
      {children}
    </Paper>
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold text-muted-foreground", className)} {...props} />;
}

type Tone = "neutral" | "success" | "warning" | "danger" | "info";
const TONE_COLOR: Record<Tone, string> = { neutral: "gray", success: "teal", warning: "orange", danger: "red", info: "blue" };

export function Badge({
  tone = "neutral",
  color,
  className,
  children,
  title,
}: { tone?: Tone; color?: string; className?: string; children?: React.ReactNode; title?: string }) {
  return (
    <MantineBadge color={color ?? TONE_COLOR[tone]} className={className} title={title}>
      {children}
    </MantineBadge>
  );
}

const ALERT_ICON: Record<"info" | "warning" | "danger" | "success", Icon> = {
  info: IconInfoCircle,
  warning: IconAlertTriangle,
  danger: IconAlertCircle,
  success: IconCircleCheck,
};

export function Alert({
  tone = "info",
  className,
  children,
  title,
}: { tone?: "info" | "warning" | "danger" | "success"; className?: string; children?: React.ReactNode; title?: React.ReactNode }) {
  const color = { info: "blue", warning: "yellow", danger: "red", success: "teal" }[tone];
  const AlertIcon = ALERT_ICON[tone];
  return (
    <MantineAlert color={color} variant="light" icon={<AlertIcon size={18} />} title={title} className={className} role="alert">
      <div className="text-sm text-foreground">{children}</div>
    </MantineAlert>
  );
}

/** Asgjë për të treguar (ose asgjë e gjetur): kuti e qetë me vijë të ndërprerë, si cis-client-2. */
export function Empty({ title, hint }: { title: string; hint?: React.ReactNode }) {
  return (
    <Paper p="xl" bg="transparent" style={{ borderStyle: "dashed" }}>
      <Stack gap={4} align="center">
        <Group justify="center" gap="xs" c="dimmed">
          <IconInbox size={18} stroke={1.6} />
          <Text c="dimmed" ta="center">
            {title}
          </Text>
        </Group>
        {hint && (
          <Text size="sm" c="dimmed" ta="center" maw={640}>
            {hint}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

/** Ngjyra e ikonës së faqes: për çfarë është faqja (si PageHead i cis-client-2). */
const PAGE_TONES = { neutral: "gray", teal: "teal", indigo: "blue", orange: "orange", violet: "violet" } as const;

/** Titulli me të cilin nis çdo faqe: ikona, titulli, përshkrimi dhe veprimet e saj djathtas. */
export function PageTitle({
  icon: IconComponent,
  title,
  subtitle,
  tone = "neutral",
  children,
}: {
  icon: Icon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  tone?: keyof typeof PAGE_TONES;
  children?: React.ReactNode;
}) {
  return (
    <Group justify="space-between" align="center" gap="md">
      <Group gap="md" wrap="nowrap" align="center">
        <ThemeIcon size={44} radius="md" variant="light" color={PAGE_TONES[tone]} visibleFrom="xs">
          <IconComponent size={24} stroke={1.7} />
        </ThemeIcon>
        <Stack gap={2}>
          <Title order={2} fz={{ base: 20, sm: 24 }}>
            {title}
          </Title>
          {subtitle && (
            <Text c="dimmed" size="sm">
              {subtitle}
            </Text>
          )}
        </Stack>
      </Group>
      {children && <Group gap="xs">{children}</Group>}
    </Group>
  );
}

/** Kartë përmbledhëse (Fatura / Pa TVSH / TVSH / Totali), si te cis-client-2. */
export function Stat({ label, value, hint, highlight = false }: { label: string; value: React.ReactNode; hint?: React.ReactNode; highlight?: boolean }) {
  return (
    <Paper px="md" py="sm" style={highlight ? { borderColor: "var(--mantine-primary-color-filled)" } : undefined}>
      <Text size="xs" c="dimmed" fw={500}>
        {label}
      </Text>
      <Text fz={{ base: 20, sm: 24 }} fw={700} className="tabular">
        {value}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Paper>
  );
}

/** Kuti zgjedhjeje e Mantine; me `name` dërgohet në formë si input i zakonshëm. */
export function Checkbox(props: React.ComponentProps<typeof MantineCheckbox>) {
  return <MantineCheckbox {...props} />;
}
