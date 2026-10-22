import { Badge, Group, Modal, Paper, Stack, Text } from "@mantine/core";
import { DataTable } from "../../components/DataTable";
import { Facts } from "../../components/ui";
import { useI18n } from "../../i18n";
import { formatDate, money, quantity } from "../../lib/format";
import { invoiceNumber } from "../../lib/invoice";
import { shortCodes, type ItemSummary, type Line } from "../../lib/items";
import type { Invoice, Kind } from "../../types";
import { PartyCell } from "./parts";

/** Every line of one item across the period; each line opens its invoice. */
export function ItemLinesDialog({
  kind,
  row,
  lines,
  onOpenInvoice,
  onClose,
}: {
  kind: Kind;
  row: ItemSummary;
  lines: Line[];
  onOpenInvoice: (invoice: Invoice) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const sorted = [...lines].sort(
    (a, b) =>
      (Date.parse(b.invoice.IssueDateTime ?? "") || 0) - (Date.parse(a.invoice.IssueDateTime ?? "") || 0),
  );
  const invoices = new Set(lines.map(({ invoice }) => invoice.FIC)).size;
  return (
    <Modal
      opened
      onClose={onClose}
      size={1080}
      title={
        <Group gap="sm">
          <Text fw={700} fz={22}>
            {row.ItemName || "—"}
          </Text>
          {row.Unit && <Badge color="gray">{row.Unit}</Badge>}
          {row.ItemCode && (
            <Badge color="gray" ff="monospace" title={row.ItemCode}>
              {shortCodes(row.ItemCode, 6)}
            </Badge>
          )}
        </Group>
      }
    >
      <Stack gap="lg">
        <Paper p="md">
          <Facts
            entries={[
              [t("col.qty"), `${quantity(row.Quantity)} ${row.Unit}`.trim()],
              [t("stats.net"), money(row.PriceWoVAT)],
              [t("stats.vat"), money(row.VATAmt)],
              [
                `${t("stats.total")} (ALL)`,
                <Text key="total" fw={700} size="sm">
                  {money(row.Price)}
                </Text>,
              ],
              [t("col.invoices"), t("items.lines", { n: lines.length, invoices })],
            ]}
            cols={{ base: 2, md: 5 }}
          />
        </Paper>
        <DataTable<Line>
          rows={sorted}
          rowKey={({ invoice }, index) => `${invoice.FIC ?? ""}-${index}`}
          onRowClick={({ invoice }) => onOpenInvoice(invoice)}
          columns={[
            { label: t("col.date"), render: ({ invoice }) => formatDate(invoice.IssueDateTime) },
            { label: t("col.number"), render: ({ invoice }) => invoiceNumber(invoice) },
            {
              label: t(kind === "SALES" ? "col.buyer" : "col.seller"),
              grow: true,
              render: ({ invoice }) => <PartyCell invoice={invoice} kind={kind} />,
            },
            { label: t("item.qty"), align: "right", render: ({ item }) => quantity(item.Q) },
            { label: t("item.upa"), align: "right", render: ({ item }) => money(item.UPA) },
            {
              label: t("item.vatRate"),
              align: "right",
              render: ({ item }) => (item.VR !== undefined ? quantity(item.VR) : ""),
            },
            {
              label: t("item.total"),
              align: "right",
              render: ({ item }) => (
                <Text size="sm" fw={700}>
                  {money(item.PA)}
                </Text>
              ),
            },
          ]}
        />
      </Stack>
    </Modal>
  );
}
