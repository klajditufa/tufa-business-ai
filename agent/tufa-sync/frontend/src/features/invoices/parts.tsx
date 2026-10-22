// Small pieces shared by the invoice list, the item list and the dialogs.
import { Badge, Button, Group, Loader, Paper, Progress, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconPlayerStop } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import { money } from "../../lib/format";
import { counterparty, isEinvoice } from "../../lib/invoice";
import type { Invoice, Kind } from "../../types";
import type { DetailsProgress } from "./useInvoiceDetails";

export function TypeBadges({ invoice }: { invoice: Invoice }) {
  const { t } = useI18n();
  const corrective = invoice.CorrectiveInv?.Type;
  return (
    <Group gap={4} wrap="nowrap">
      <Badge color={invoice.TypeOfInv === "CASH" ? "gray" : "blue"}>
        {t(invoice.TypeOfInv === "CASH" ? "type.CASH" : "type.NONCASH")}
      </Badge>
      {isEinvoice(invoice) && <Badge color="indigo">{t("badge.einvoice")}</Badge>}
      {corrective && (
        <Badge color="orange">
          {t(
            corrective === "CREDIT"
              ? "badge.CREDIT"
              : corrective === "DEBIT"
                ? "badge.DEBIT"
                : "badge.CORRECTIVE",
          )}
        </Badge>
      )}
      {(invoice.IsBadDeb === "true" || invoice.BadDebtInv) && (
        <Badge color="orange">{t("badge.badDebt")}</Badge>
      )}
    </Group>
  );
}

/** Name over identifier, as used for parties and items in tables. */
export function TwoLines({ title, detail }: { title?: string; detail?: string }) {
  return (
    <div>
      <Text size="sm" fw={600} lh={1.3}>
        {title || "—"}
      </Text>
      {detail && (
        <Text size="xs" c="dimmed" ff="monospace" lh={1.4}>
          {detail}
        </Text>
      )}
    </div>
  );
}

export function PartyCell({ invoice, kind }: { invoice: Invoice; kind: Kind }) {
  const party = counterparty(invoice, kind);
  return <TwoLines title={party.Name} detail={party.IDNum} />;
}

export function Stats({
  count,
  of,
  net,
  vat,
  total,
}: {
  count: number;
  of: number;
  net: number;
  vat: number;
  total: number;
}) {
  const { t } = useI18n();
  const stat = (label: string, value: string, sub?: string, strong?: boolean) => (
    <Paper p="md" style={strong ? { borderColor: "var(--mantine-primary-color-filled)" } : undefined}>
      <Text size="xs" fw={600} c="dimmed">
        {label}
      </Text>
      <Group gap={6} align="baseline">
        <Text fz={22} fw={700} lh={1.3}>
          {value}
        </Text>
        {sub && (
          <Text size="xs" c="dimmed">
            {sub}
          </Text>
        )}
      </Group>
    </Paper>
  );
  return (
    <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
      {stat(t("stats.count"), String(count), count !== of ? t("stats.of", { n: of }) : undefined)}
      {stat(t("stats.net"), money(net))}
      {stat(t("stats.vat"), money(vat))}
      {stat(`${t("stats.total")} (ALL)`, money(total), undefined, true)}
    </SimpleGrid>
  );
}

/** "Fetching invoices from CIS… 12 s" while a long request runs. */
export function Elapsed({ text }: { text: string }) {
  const { t } = useI18n();
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.round((now - start) / 1000);
  return (
    <Paper p="md">
      <Group gap="sm">
        <Loader size="sm" />
        <Text size="sm">
          {text} {seconds ? t("common.seconds", { n: seconds }) : ""}
        </Text>
      </Group>
    </Paper>
  );
}

export function ItemsProgress({ progress, onStop }: { progress: DetailsProgress; onStop: () => void }) {
  const { t } = useI18n();
  return (
    <Paper p="md" role="status">
      <Stack gap="sm">
        <Group gap="sm" wrap="nowrap">
          <Loader size="sm" />
          <Text fw={600} size="sm" style={{ flex: 1 }}>
            {t("items.loading", { done: progress.done, total: progress.total })}
          </Text>
          <Button size="xs" variant="default" leftSection={<IconPlayerStop size={14} />} onClick={onStop}>
            {t("items.stop")}
          </Button>
        </Group>
        <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} size="sm" animated />
        <Text size="xs" c="dimmed">
          {t("items.note")}
        </Text>
      </Stack>
    </Paper>
  );
}
