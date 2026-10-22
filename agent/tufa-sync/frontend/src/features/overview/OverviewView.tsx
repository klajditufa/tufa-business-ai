// Every loaded business side by side for one period: what an accountant checks before the VAT and turnover declarations.
import { Badge, Button, Group, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconDownload, IconFileTypePdf, IconLayoutGrid } from "@tabler/icons-react";
import { useState } from "react";
import { api } from "../../api";
import { DataTable } from "../../components/DataTable";
import { PageHead } from "../../components/PageHead";
import { PeriodControls, type Period } from "../../components/PeriodControls";
import { EnvironmentBadge, Empty, ErrorBox } from "../../components/ui";
import { useI18n } from "../../i18n";
import { download, toCsv } from "../../lib/files";
import { cents, documentDate, formatDate, isoDay, money, presetRange } from "../../lib/format";
import { getPreference, setPreference } from "../../lib/preferences";
import { makePdf } from "../../pdf/pdfmake";
import { reportDocument } from "../../pdf/report";
import type { Business, OverviewRow } from "../../types";
import { Elapsed } from "../invoices/parts";
import { businessName, useSession } from "../session/context";

interface Row extends OverviewRow {
  business: Business;
  balance: number | null; // output VAT − input VAT, in cents
}

const CSV_COLUMNS = [
  "NIPT",
  "Name",
  "Environment",
  "SalesCount",
  "SalesNet",
  "SalesVAT",
  "SalesTotal",
  "PurchaseCount",
  "PurchaseNet",
  "PurchaseVAT",
  "PurchaseTotal",
  "VATDifference",
  "Error",
] as const;

export function OverviewView({ onOpen }: { onOpen: (business: Business) => void }) {
  const { t } = useI18n();
  const { session } = useSession();
  const [period, setPeriod] = useState<Period>(() => {
    const preset = getPreference("overviewPreset");
    const [from, to] = presetRange(preset === "custom" ? "lastMonth" : preset);
    return { preset, from, to };
  });
  const [result, setResult] = useState<{ rows: Row[]; from: string; to: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function fetchTotals() {
    setLoading(true);
    setError(null);
    try {
      const { businesses } = await api<{ businesses: OverviewRow[] }>("/api/overview", {
        FromDate: period.from,
        ToDate: period.to,
      });
      const byId = new Map(session.businesses.map((business) => [business.id, business]));
      setResult({
        from: period.from,
        to: period.to,
        rows: businesses.flatMap((row) => {
          const business = byId.get(row.id);
          if (!business) return [];
          const balance = row.sales && row.purchases ? cents(row.sales.vat) - cents(row.purchases.vat) : null;
          return [{ ...row, business, balance }];
        }),
      });
    } catch (reason) {
      setError(reason);
    } finally {
      setLoading(false);
    }
  }

  const rows = result?.rows ?? [];
  const sum = (read: (row: Row) => string | undefined) =>
    rows.reduce((total, row) => total + cents(read(row)), 0) / 100;
  const name = result ? `businesses_${result.from}_${result.to}` : "";

  function exportCsv() {
    download(
      `${name}.csv`,
      toCsv(
        rows.map((row) => ({
          NIPT: row.business.certificate.nipt ?? "",
          Name: businessName(row.business),
          Environment: row.business.environment,
          SalesCount: row.sales?.count,
          SalesNet: row.sales?.net,
          SalesVAT: row.sales?.vat,
          SalesTotal: row.sales?.total,
          PurchaseCount: row.purchases?.count,
          PurchaseNet: row.purchases?.net,
          PurchaseVAT: row.purchases?.vat,
          PurchaseTotal: row.purchases?.total,
          VATDifference: row.balance === null ? "" : (row.balance / 100).toFixed(2),
          Error: row.error?.message ?? "",
        })),
        CSV_COLUMNS,
      ),
    );
  }

  async function exportPdf() {
    if (!result) return;
    try {
      const document = reportDocument<Row>(
        {
          title: t("tabs.overview"),
          subtitle: t("biz.count", { n: rows.length }),
          details: [
            `${t("inv.period")}: ${documentDate(result.from, false)} – ${documentDate(result.to, false)}`,
            t("pdf.generated", { date: documentDate(isoDay(new Date()), false) }),
          ],
          columns: [
            {
              label: t("ov.business"),
              value: (row) => `${businessName(row.business)}\n${row.business.certificate.nipt ?? ""}`,
              width: "*",
            },
            { label: t("ov.salesCount"), value: (row) => row.sales?.count, right: true },
            { label: t("ov.turnover"), value: (row) => money(row.sales?.net), right: true },
            { label: t("ov.salesVat"), value: (row) => money(row.sales?.vat), right: true },
            { label: t("ov.purchaseCount"), value: (row) => row.purchases?.count, right: true },
            { label: t("ov.purchaseNet"), value: (row) => money(row.purchases?.net), right: true },
            { label: t("ov.purchaseVat"), value: (row) => money(row.purchases?.vat), right: true },
            {
              label: t("ov.vatBalance"),
              value: (row) => (row.balance === null ? row.error?.message : money(row.balance / 100)),
              right: true,
            },
          ],
          rows,
          totals: [
            t("ov.total"),
            "",
            money(sum((row) => row.sales?.net)),
            money(sum((row) => row.sales?.vat)),
            "",
            money(sum((row) => row.purchases?.net)),
            money(sum((row) => row.purchases?.vat)),
            money(sum((row) => row.sales?.vat) - sum((row) => row.purchases?.vat)),
          ],
        },
        t,
      );
      download(`${name}.pdf`, await makePdf(document));
    } catch (reason) {
      setError(reason);
    }
  }

  const stat = (label: string, value: number, strong?: boolean) => (
    <Paper p="md" style={strong ? { borderColor: "var(--mantine-primary-color-filled)" } : undefined}>
      <Text size="xs" fw={600} c="dimmed">
        {label}
      </Text>
      <Text fz={22} fw={700}>
        {money(value)}
      </Text>
    </Paper>
  );

  return (
    <Stack gap="md">
      <PageHead icon={IconLayoutGrid} tone="overview" title={t("tabs.overview")} description={t("ov.lead")} />
      <Paper p={{ base: "sm", sm: "md" }}>
        <PeriodControls
          period={period}
          onChange={(next) => {
            setPeriod(next);
            if (next.preset !== "custom") setPreference("overviewPreset", next.preset);
          }}
          submitLabel={t("ov.fetch")}
          loading={loading}
          onSubmit={() => void fetchTotals()}
        />
      </Paper>
      {loading && <Elapsed text={t("ov.loading")} />}
      {error !== null && <ErrorBox error={error} />}
      {!result && !loading && <Empty>{t("ov.initial")}</Empty>}
      {result && !loading && (
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {t("inv.periodLabel", {
                from: formatDate(result.from, false),
                to: formatDate(result.to, false),
              })}
            </Text>
            <Group gap="xs">
              <Button
                size="sm"
                variant="default"
                leftSection={<IconDownload size={16} />}
                onClick={exportCsv}
              >
                {t("export.csv")}
              </Button>
              <Button
                size="sm"
                variant="default"
                leftSection={<IconFileTypePdf size={16} />}
                onClick={() => void exportPdf()}
              >
                {t("pdf.menu")}
              </Button>
            </Group>
          </Group>
          <DataTable<Row>
            rows={rows}
            rowKey={(row) => row.id}
            onRowClick={(row) => onOpen(row.business)}
            minWidth={1000}
            columns={[
              {
                label: t("ov.business"),
                grow: true,
                render: (row) => (
                  <Stack gap={2}>
                    <Text size="sm" fw={600}>
                      {businessName(row.business)}
                    </Text>
                    <Group gap={6}>
                      <Text size="xs" c="dimmed" ff="monospace">
                        {row.business.certificate.nipt}
                      </Text>
                      <EnvironmentBadge environment={row.business.environment} />
                    </Group>
                    {row.error && (
                      <Badge color="red">{row.error.cisError?.faultString || row.error.message}</Badge>
                    )}
                  </Stack>
                ),
              },
              { label: t("ov.salesCount"), align: "right", render: (row) => row.sales?.count ?? "—" },
              {
                label: t("ov.turnover"),
                align: "right",
                render: (row) => (
                  <Text size="sm" fw={700}>
                    {money(row.sales?.net)}
                  </Text>
                ),
              },
              { label: t("ov.salesVat"), align: "right", render: (row) => money(row.sales?.vat) },
              { label: t("ov.purchaseCount"), align: "right", render: (row) => row.purchases?.count ?? "—" },
              { label: t("ov.purchaseNet"), align: "right", render: (row) => money(row.purchases?.net) },
              { label: t("ov.purchaseVat"), align: "right", render: (row) => money(row.purchases?.vat) },
              {
                label: t("ov.vatBalance"),
                align: "right",
                render: (row) =>
                  row.balance === null ? (
                    "—"
                  ) : (
                    <Text size="sm" fw={700}>
                      {money(row.balance / 100)}
                    </Text>
                  ),
              },
            ]}
          />
          {rows.length > 1 && (
            <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
              {stat(
                `${t("ov.turnover")} · ${t("ov.total")}`,
                sum((row) => row.sales?.net),
              )}
              {stat(
                t("ov.salesVat"),
                sum((row) => row.sales?.vat),
              )}
              {stat(
                t("ov.purchaseVat"),
                sum((row) => row.purchases?.vat),
              )}
              {stat(
                t("ov.vatBalance"),
                sum((row) => row.sales?.vat) - sum((row) => row.purchases?.vat),
                true,
              )}
            </SimpleGrid>
          )}
          <Text size="xs" c="dimmed">
            {t("ov.vatNote")}
          </Text>
        </Stack>
      )}
    </Stack>
  );
}
