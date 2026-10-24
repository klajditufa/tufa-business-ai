import { Button, Group, Select } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconCalendar } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useI18n } from "../i18n";
import { presetRange, PRESETS, type Preset } from "../lib/format";

export interface Period {
  preset: Preset;
  from: string; // YYYY-MM-DD
  to: string;
}

/** Reads a typed date: 17.10.2026, 17/10/2026, 17-10-2026 (day first) or 2026-10-17. */
export function parseDate(text: string): string | null {
  const value = text.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(value);
  if (!match) return null;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** A period: a preset (this month, last month, ...) or any dates, typed or picked on the calendar. */
export function PeriodControls({
  period,
  onChange,
  submitLabel,
  loading,
  onSubmit,
  children,
  disabled = false,
}: {
  period: Period;
  onChange: (period: Period) => void;
  submitLabel: string;
  loading: boolean;
  onSubmit: () => void;
  children?: ReactNode;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const dateProps = {
    disabled,
    valueFormat: "DD.MM.YYYY",
    dateParser: parseDate,
    placeholder: "dd.mm.yyyy",
    leftSection: <IconCalendar size={16} stroke={1.8} />,
    w: { base: "calc(50% - var(--mantine-spacing-sm) / 2)", sm: 160 },
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Group align="flex-end" gap="sm">
        <Select
          disabled={disabled}
          label={t("inv.period")}
          w={{ base: "100%", sm: 170 }}
          data={PRESETS.map((preset) => ({ value: preset, label: t(`preset.${preset}`) }))}
          value={period.preset}
          onChange={(value) => {
            const preset = value ?? "thisMonth";
            const [from, to] = preset === "custom" ? [period.from, period.to] : presetRange(preset);
            onChange({ preset, from, to });
          }}
        />
        <DateInput
          {...dateProps}
          label={t("inv.from")}
          value={period.from}
          onChange={(from) => {
            if (from) onChange({ preset: "custom", from, to: from > period.to ? from : period.to });
          }}
        />
        <DateInput
          {...dateProps}
          label={t("inv.to")}
          value={period.to}
          minDate={period.from}
          onChange={(to) => {
            if (to) onChange({ preset: "custom", from: to < period.from ? to : period.from, to });
          }}
        />
        <Button type="submit" loading={loading} w={{ base: "100%", sm: "auto" }}>
          {submitLabel}
        </Button>
        {children}
      </Group>
    </form>
  );
}
