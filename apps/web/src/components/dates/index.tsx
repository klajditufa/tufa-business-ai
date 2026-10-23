"use client";

import { useState } from "react";
import { DateInput, type DateInputProps } from "@mantine/dates";
import { IconCalendar } from "@tabler/icons-react";

/** Lexon datën e shtypur: 17.10.2026, 17/10/2026, 17-10-2026 (dita e para) ose 2026-10-17 (nga cis-client-2). */
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

/** Vetitë e përbashkëta të fushave të datave, si te PeriodControls i cis-client-2. */
export const DATE_PROPS = {
  valueFormat: "DD.MM.YYYY",
  dateParser: parseDate,
  placeholder: "dd.mm.vvvv",
  leftSection: <IconCalendar size={16} stroke={1.8} />,
} satisfies Partial<DateInputProps>;

/**
 * Fushë date me kalendarin e Mantine (shfaqet 17.10.2026) që dërgohet në formë si VVVV-MM-DD
 * përmes një input-i të fshehur — punon me server actions dhe forma GET.
 */
export function DateField({
  name,
  label,
  defaultValue,
  value: controlled,
  onChange,
  required,
  minDate,
  maxDate,
  disabled,
  id,
  className,
  w,
  size,
  clearable,
}: {
  name?: string;
  label?: React.ReactNode;
  defaultValue?: string | null;
  value?: string | null;
  onChange?: (value: string | null) => void;
  required?: boolean;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  w?: DateInputProps["w"];
  size?: DateInputProps["size"];
  clearable?: boolean;
}) {
  const [inner, setInner] = useState<string | null>(defaultValue ?? null);
  const value = controlled !== undefined ? controlled : inner;
  return (
    <>
      <DateInput
        {...DATE_PROPS}
        id={id}
        label={label}
        value={value}
        onChange={(next) => {
          if (controlled === undefined) setInner(next);
          onChange?.(next);
        }}
        required={required}
        minDate={minDate}
        maxDate={maxDate}
        disabled={disabled}
        className={className}
        w={w}
        size={size}
        clearable={clearable}
      />
      {name && !disabled && <input type="hidden" name={name} value={value ?? ""} />}
    </>
  );
}
