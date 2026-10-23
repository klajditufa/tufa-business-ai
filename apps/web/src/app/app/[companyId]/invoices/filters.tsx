"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Divider, Group, NativeSelect, Paper, SegmentedControl, Select, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconBox, IconBuildingBank, IconDownload, IconList, IconSearch } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import type { InvoiceFilters } from "@/server/services/invoices";
import { DATE_PROPS } from "@/components/dates";

type Preset = "thisMonth" | "lastMonth" | "thisQuarter" | "thisYear" | "lastYear" | "all" | "custom";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function presetRange(p: Preset, today = new Date()): { from: string; to: string } | null {
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (p) {
    case "thisMonth":
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case "lastMonth":
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case "thisQuarter": {
      const q = Math.floor(m / 3) * 3;
      return { from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) };
    }
    case "thisYear":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "lastYear":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default:
      return null;
  }
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: "thisMonth", label: "Ky muaj" },
  { value: "lastMonth", label: "Muaji i kaluar" },
  { value: "thisQuarter", label: "Ky tremujor" },
  { value: "thisYear", label: "Ky vit" },
  { value: "lastYear", label: "Viti i kaluar" },
  { value: "all", label: "Të gjitha" },
  { value: "custom", label: "Periudhë tjetër" },
];

function detect(range: { from: string; to: string } | null): Preset {
  if (!range) return "all";
  for (const { value } of PRESETS) {
    const r = presetRange(value);
    if (r && r.from === range.from && r.to === range.to) return value;
  }
  return "custom";
}

/**
 * Filtrat e faturave me komponentët e cis-client-2: periudha (paracaktim + Nga/Deri me kalendar),
 * pastaj "Faturat | Sipas artikujve", kërkimi, lloji, pagesa dhe eksportet. URL-ja mbetet e ndashme.
 */
export function InvoiceFilterBar({
  basePath,
  itemsHref,
  f,
  range,
}: {
  basePath: string;
  itemsHref: string;
  f: InvoiceFilters;
  range: { from: string; to: string } | null;
}) {
  const router = useRouter();
  const [preset, setPreset] = useState<Preset>(detect(range));
  const [from, setFrom] = useState<string | null>(range?.from ?? presetRange("thisMonth")!.from);
  const [to, setTo] = useState<string | null>(range?.to ?? presetRange("thisMonth")!.to);
  const [q, setQ] = useState(f.q ?? "");
  const [kind, setKind] = useState(f.kind ?? "all");
  const [status, setStatus] = useState(f.status ?? "all");

  const url = (over: { from?: string | null; to?: string | null; all?: boolean } = {}) => {
    const p = new URLSearchParams({ direction: f.direction });
    const all = over.all ?? preset === "all";
    if (all) p.set("period", "all");
    else {
      p.set("from", over.from ?? from ?? "");
      p.set("to", over.to ?? to ?? "");
    }
    if (q.trim()) p.set("q", q.trim());
    if (kind !== "all") p.set("kind", kind);
    if (status !== "all") p.set("status", status);
    return p;
  };
  const apply = () => router.push(`${basePath}?${url()}`);
  const dateW = { base: "calc(50% - var(--mantine-spacing-sm) / 2)", sm: 160 };

  return (
    <>
      <Paper p={{ base: "sm", sm: "md" }}>
        <Group align="flex-end" gap="lg" wrap="wrap">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              apply();
            }}
            style={{ flex: "1 1 auto" }}
          >
            <Group align="flex-end" gap="sm">
              <Select
                label="Periudha"
                w={{ base: "100%", sm: 170 }}
                data={PRESETS}
                value={preset}
                onChange={(value) => {
                  const next = (value ?? "thisMonth") as Preset;
                  setPreset(next);
                  const r = presetRange(next);
                  if (r) {
                    setFrom(r.from);
                    setTo(r.to);
                  }
                }}
              />
              <DateInput
                {...DATE_PROPS}
                label="Nga"
                w={dateW}
                disabled={preset === "all"}
                value={from}
                onChange={(value) => {
                  if (!value) return;
                  setPreset("custom");
                  setFrom(value);
                  if (to && value > to) setTo(value);
                }}
              />
              <DateInput
                {...DATE_PROPS}
                label="Deri"
                w={dateW}
                disabled={preset === "all"}
                value={to}
                minDate={from ?? undefined}
                onChange={(value) => {
                  if (!value) return;
                  setPreset("custom");
                  setTo(value);
                  if (from && value < from) setFrom(value);
                }}
              />
              <Button type="submit" w={{ base: "100%", sm: "auto" }}>
                Shfaq faturat
              </Button>
            </Group>
          </form>
          <Divider orientation="vertical" visibleFrom="md" />
          <Group gap="xs" visibleFrom="md" align="flex-end">
            <Button
              component={Link}
              href={`${basePath}/bank`}
              variant="default"
              leftSection={<IconBuildingBank size={16} stroke={1.8} />}
            >
              Rakordimi me bankën
            </Button>
          </Group>
        </Group>
      </Paper>

      <Group gap="sm" wrap="wrap">
        <SegmentedControl
          value="invoices"
          onChange={(value) => value === "items" && router.push(itemsHref)}
          data={[
            {
              value: "invoices",
              label: (
                <Group gap={6} wrap="nowrap">
                  <IconList size={16} stroke={1.8} /> Faturat
                </Group>
              ),
            },
            {
              value: "items",
              label: (
                <Group gap={6} wrap="nowrap">
                  <IconBox size={16} stroke={1.8} /> Sipas artikujve
                </Group>
              ),
            },
          ]}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
          style={{ flex: "1 1 260px" }}
        >
          <TextInput
            placeholder="Filtro sipas numrit, NIPT-it, emrit ose NIVF"
            leftSection={<IconSearch size={16} stroke={1.8} />}
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
          />
        </form>
        <NativeSelect
          aria-label="Lloji"
          w={{ base: "100%", xs: 190 }}
          value={kind}
          onChange={(e) => {
            setKind(e.currentTarget.value as typeof kind);
            const p = url();
            if (e.currentTarget.value === "all") p.delete("kind");
            else p.set("kind", e.currentTarget.value);
            router.push(`${basePath}?${p}`);
          }}
          data={[
            { value: "all", label: "Të gjitha llojet" },
            { value: "noncash", label: "Pa para në dorë" },
            { value: "cash", label: "Me para në dorë" },
            { value: "einvoice", label: "E-faturë" },
          ]}
        />
        <NativeSelect
          aria-label="Pagesa"
          w={{ base: "100%", xs: 170 }}
          value={status}
          onChange={(e) => {
            setStatus(e.currentTarget.value as typeof status);
            const p = url();
            if (e.currentTarget.value === "all") p.delete("status");
            else p.set("status", e.currentTarget.value);
            router.push(`${basePath}?${p}`);
          }}
          data={[
            { value: "all", label: "Çdo pagesë" },
            { value: "unpaid", label: "Të papaguara" },
            { value: "partial", label: "Pjesërisht" },
            { value: "paid", label: "Të paguara" },
          ]}
        />
        <Group gap="xs" ml={{ base: 0, md: "auto" }}>
          <Button
            component="a"
            href={`${basePath}/export?${range ? new URLSearchParams({ ...Object.fromEntries(url({ from: range.from, to: range.to, all: false })) }) : url({ all: true })}`}
            variant="default"
            leftSection={<IconDownload size={16} stroke={1.8} />}
          >
            CSV
          </Button>
          <Button component={Link} href={`${basePath}/bank`} variant="default" hiddenFrom="md" leftSection={<IconBuildingBank size={16} stroke={1.8} />}>
            Banka
          </Button>
        </Group>
      </Group>
    </>
  );
}
