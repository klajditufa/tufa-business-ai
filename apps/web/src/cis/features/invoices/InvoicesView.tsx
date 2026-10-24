import {
  Alert,
  Button,
  CloseButton,
  Divider,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconBox,
  IconDownload,
  IconFilterOff,
  IconList,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, invoicesPath } from "../../api";
import { DataTable } from "../../components/DataTable";
import { PageHead } from "../../components/PageHead";
import { PeriodControls, type Period } from "../../components/PeriodControls";
import { Empty, ErrorBox } from "../../components/ui";
import { useI18n } from "../../i18n";
import { download, fileName, zip } from "../../lib/files";
import { cents, formatDate, money, presetRange, quantity } from "../../lib/format";
import { invoiceNumber, netAmount } from "../../lib/invoice";
import { itemKey, shortCodes, summarise, type ItemSummary } from "../../lib/items";
import { getPreference, setPreference, usePreference } from "../../lib/preferences";
import { invoicesDocument } from "../../pdf/invoice";
import { makePdf } from "../../pdf/pdfmake";
import { reportDocument } from "../../pdf/report";
import type { Invoice, Kind } from "../../types";
import { useApi, useCertificateBusiness } from "../session/context";
import { ExportMenu, type PdfAction } from "./ExportMenu";
import { invoiceListReport, invoicesCsv, invoicesJson, itemReport, linesCsv, summaryCsv } from "./exports";
import {
  filterInvoices,
  filterLines,
  invoicesOf,
  sortSummary,
  TYPE_FILTERS,
  type TypeFilter,
} from "./filters";
import { InvoiceDialog } from "./InvoiceDialog";
import { ItemLinesDialog } from "./ItemLinesDialog";
import { Elapsed, ItemsProgress, PartyCell, Stats, TwoLines, TypeBadges } from "./parts";
import { useInvoiceDetails } from "./useInvoiceDetails";

type Opened = { type: "invoice"; invoice: Invoice } | { type: "item"; row: ItemSummary } | null;

interface Fetched {
  invoices: Invoice[];
  from: string;
  to: string;
}

/** Sales or purchases of the current business for a period: as invoices, or summed up by item. */
export function InvoicesView({ kind, actions }: { kind: Kind; actions?: ReactNode }) {
  const { t, lang } = useI18n();
  const call = useApi();
  const business = useCertificateBusiness();
  const details = useInvoiceDetails(kind);
  const { load, known, progress } = details;
  const isSales = kind === "SALES";

  const [period, setPeriod] = useState<Period>(() => {
    const preset = getPreference("preset");
    const [from, to] = presetRange(preset === "custom" ? "thisMonth" : preset);
    return { preset, from, to };
  });
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [fic, setFic] = useState("");
  const [ficState, setFicState] = useState<{ loading: boolean; error: unknown }>({
    loading: false,
    error: null,
  });
  const [mode, setMode] = usePreference("mode");
  const [filter, setFilter] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [sort, setSort] = usePreference("invoiceSort");
  const [itemSort, setItemSort] = usePreference("itemSort");
  const [opened, setOpened] = useState<Opened>(null);
  const [job, setJob] = useState<string | null>(null);
  const [jobError, setJobError] = useState<unknown>(null);

  const needle = filter.trim().toLowerCase();
  const filtered = Boolean(needle) || type !== "all";
  const invoices = useMemo(
    () => (fetched ? filterInvoices(fetched.invoices, type, needle, kind, sort) : []),
    [fetched, type, needle, kind, sort],
  );
  const lines = useMemo(
    () => (fetched && mode === "items" ? filterLines(fetched.invoices, known, type, needle, kind) : []),
    [fetched, mode, known, type, needle, kind],
  );
  const summary = useMemo(() => sortSummary(summarise(lines, lang), itemSort), [lines, lang, itemSort]);
  const baseName = fetched ? `${isSales ? "sales" : "purchases"}_${fetched.from}_${fetched.to}` : "";
  const missing = fetched ? details.missing(fetched.invoices).length : 0;

  // TUFA: në hapje shfaqen menjëherë faturat e periudhës që janë në TUFA; "Merr faturat" i merr nga CIS.
  const initial = useRef(false);
  useEffect(() => {
    if (initial.current) return;
    initial.current = true;
    void fetchPeriod("db");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // In item mode every invoice of the period is needed with its items.
  useEffect(() => {
    if (mode === "items" && fetched) void load(fetched.invoices);
  }, [mode, fetched, load]);

  // TUFA: `source: "db"` shfaq faturat që janë tashmë në TUFA (pa thirrje te CIS).
  async function fetchPeriod(source?: "db") {
    if (loading) return;
    details.stop();
    setLoading(true);
    setError(null);
    try {
      const found = await call<Invoice[]>(invoicesPath(kind), {
        FromDate: period.from,
        ToDate: period.to,
        All: true,
        ...(source ? { Source: source } : {}),
      });
      setFetched({ invoices: found, from: period.from, to: period.to });
    } catch (reason) {
      setError(reason);
    } finally {
      setLoading(false);
    }
  }

  async function openByFic() {
    const value = fic.trim();
    if (!value) return;
    setFicState({ loading: true, error: null });
    try {
      const found = await call<Invoice[]>(invoicesPath(kind), { FIC: value });
      if (!found[0]) throw new ApiError(404, { message: t("inv.notFound") });
      details.remember(found[0]);
      setOpened({ type: "invoice", invoice: found[0] });
      setFicState({ loading: false, error: null });
    } catch (reason) {
      setFicState({ loading: false, error: reason });
    }
  }

  /** PDFs of what is on screen; all but the list need every invoice's items first. */
  async function makePdfs(action: PdfAction) {
    if (!fetched || job) return;
    setJobError(null);
    const context = { t, lang, environment: business.environment };
    const scope = {
      t,
      kind,
      business,
      period: fetched,
      filter: [type !== "all" ? t(`type.${type}`) : "", filter.trim()].filter(Boolean).join(" · "),
    };
    try {
      setJob(t("pdf.making"));
      if (action === "list") {
        download(`${baseName}.pdf`, await makePdf(reportDocument(invoiceListReport(invoices, scope), t)));
        return;
      }
      if (!(await load(fetched.invoices)) || details.missing(fetched.invoices).length) {
        throw new ApiError(0, { message: t("pdf.needItems") });
      }
      // This render's `known` predates the loading above; read what is loaded now.
      const live = details.current();
      const current = filterLines(fetched.invoices, live, type, needle, kind);
      if (action === "items") {
        const rows = sortSummary(summarise(current, lang), itemSort);
        download(`${baseName}_items.pdf`, await makePdf(reportDocument(itemReport(rows, scope), t)));
        return;
      }
      // In item mode the filter can match single lines; take the invoices those lines belong to.
      const chosen =
        mode === "items"
          ? invoicesOf(current)
          : [...invoices].reverse().map((invoice) => (invoice.FIC && live.get(invoice.FIC)) || invoice);
      if (action === "all") {
        const title = `${t(isSales ? "tabs.sales" : "tabs.purchases")} ${fetched.from} – ${fetched.to}`;
        download(`${baseName}_invoices.pdf`, await makePdf(invoicesDocument(chosen, context, title)));
        return;
      }
      const files = [];
      for (const [index, invoice] of chosen.entries()) {
        setJob(t("pdf.makingMany", { done: index, total: chosen.length }));
        const number = invoiceNumber(invoice);
        const pdf = await makePdf(invoicesDocument([invoice], context, `${t("pdf.invoice")} ${number}`));
        files.push({
          name: `${fileName(t("pdf.invoice"), number)}.pdf`,
          bytes: new Uint8Array(await pdf.arrayBuffer()),
        });
      }
      download(`${baseName}_invoices.zip`, zip(files));
    } catch (reason) {
      setJobError(reason);
    } finally {
      setJob(null);
    }
  }

  const busy = Boolean(job) || (mode === "items" && progress.loading);
  const sum = (values: (string | undefined)[]) =>
    values.reduce((total, value) => total + cents(value), 0) / 100;
  const toggle = (current: typeof sort, key: string, ascendingFirst: boolean) =>
    current.key === key
      ? { key, dir: current.dir === 1 ? (-1 as const) : (1 as const) }
      : { key, dir: ascendingFirst ? (1 as const) : (-1 as const) };

  return (
    <Stack gap="md">
      <PageHead
        icon={isSales ? IconArrowUpRight : IconArrowDownLeft}
        tone={isSales ? "sales" : "purchases"}
        title={t(isSales ? "tabs.sales" : "tabs.purchases")}
        description={t(isSales ? "view.sales" : "view.purchases")}
      />

      <Paper p={{ base: "sm", sm: "md" }}>
        <Group align="flex-end" gap="md" wrap="wrap">
          <PeriodControls
            period={period}
            onChange={(next) => {
              setPeriod(next);
              if (next.preset !== "custom") setPreference("preset", next.preset); // typed dates are not a default
            }}
            submitLabel={t("inv.fetch")}
            loading={loading}
            onSubmit={() => void fetchPeriod()}
          />
          <Divider orientation="vertical" visibleFrom="md" />
          <form
            style={{ flex: 1, minWidth: "min(280px, 100%)" }}
            onSubmit={(event) => {
              event.preventDefault();
              void openByFic();
            }}
          >
            <Group align="flex-end" gap="sm" wrap="nowrap">
              <TextInput
                label={t("inv.fic")}
                placeholder={t("inv.ficPlaceholder")}
                value={fic}
                onChange={(event) => setFic(event.currentTarget.value)}
                spellCheck={false}
                autoComplete="off"
                className="mono-input"
                style={{ flex: 1 }}
              />
              <Button type="submit" variant="default" loading={ficState.loading}>
                {t("inv.open")}
              </Button>
            </Group>
          </form>
        </Group>
        {ficState.error !== null && (
          <Stack mt="sm">
            <ErrorBox error={ficState.error} />
          </Stack>
        )}
      </Paper>

      {loading && <Elapsed text={t("inv.loading")} />}
      {error !== null && <ErrorBox error={error} />}
      {!fetched && !loading && error === null && <Empty>{t("inv.initial")}</Empty>}

      {fetched && !loading && (
        <>
          <Group justify="space-between" gap="sm">
            <Group gap="sm" style={{ flex: 1 }}>
              <SegmentedControl
                w={{ base: "100%", sm: "auto" }}
                value={mode}
                onChange={(value) => setMode(value)}
                aria-label={t("inv.mode")}
                data={[
                  {
                    value: "invoices",
                    label: (
                      <Group gap={6} wrap="nowrap">
                        <IconList size={15} />
                        {t("inv.mode.invoices")}
                      </Group>
                    ),
                  },
                  {
                    value: "items",
                    label: (
                      <Group gap={6} wrap="nowrap">
                        <IconBox size={15} />
                        {t("inv.mode.items")}
                      </Group>
                    ),
                  },
                ]}
              />
              <TextInput
                placeholder={t("inv.filter")}
                leftSection={<IconSearch size={16} stroke={1.8} />}
                rightSection={
                  filter ? (
                    <CloseButton
                      size="sm"
                      onClick={() => setFilter("")}
                      aria-label={t("filters.clearText")}
                    />
                  ) : null
                }
                value={filter}
                onChange={(event) => setFilter(event.currentTarget.value)}
                w={{ base: "100%", sm: "auto" }}
                style={{ flex: 1, minWidth: "min(220px, 100%)", maxWidth: 440 }}
              />
              <Select
                w={{ base: "100%", sm: 210 }}
                aria-label={t("col.type")}
                data={TYPE_FILTERS.map((value) => ({ value, label: t(`type.${value}`) }))}
                value={type}
                onChange={(value) => setType(value ?? "all")}
              />
              {filtered && (
                <Button
                  variant="subtle"
                  color="gray"
                  leftSection={<IconFilterOff size={16} />}
                  onClick={() => {
                    setFilter("");
                    setType("all");
                  }}
                >
                  {t("filters.clear")}
                </Button>
              )}
            </Group>
            <Group gap="xs">
              {mode === "invoices" ? (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={busy}
                    leftSection={<IconDownload size={16} />}
                    onClick={() => invoicesCsv(invoices, business.environment, baseName)}
                  >
                    {t("export.csv")}
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={busy}
                    leftSection={<IconDownload size={16} />}
                    onClick={() => invoicesJson(invoices, baseName)}
                  >
                    {t("export.json")}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={busy}
                    leftSection={<IconDownload size={16} />}
                    onClick={() => summaryCsv(summary, baseName)}
                  >
                    {t("export.csv")}
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={busy}
                    leftSection={<IconDownload size={16} />}
                    onClick={() => linesCsv(lines, business.environment, baseName)}
                  >
                    {t("export.lines")}
                  </Button>
                </>
              )}
              <ExportMenu disabled={busy} onSelect={(action) => void makePdfs(action)} />
              {actions}
            </Group>
          </Group>

          {job &&
            (progress.loading ? (
              <ItemsProgress progress={progress} onStop={details.stop} />
            ) : (
              <Elapsed key={job} text={job} />
            ))}
          {jobError !== null && <ErrorBox error={jobError} />}

          {mode === "invoices" ? (
            <Stack gap="sm">
              <Stats
                count={invoices.length}
                of={fetched.invoices.length}
                net={sum(invoices.map(netAmount))}
                vat={sum(invoices.map((invoice) => invoice.TotVATAmt))}
                total={sum(invoices.map((invoice) => invoice.TotPrice))}
              />
              <Text size="sm" c="dimmed">
                {t("inv.periodLabel", {
                  from: formatDate(fetched.from, false),
                  to: formatDate(fetched.to, false),
                })}
              </Text>
              {!fetched.invoices.length ? (
                <Empty>{t("inv.empty")}</Empty>
              ) : !invoices.length ? (
                <Empty>{t("inv.noMatch")}</Empty>
              ) : (
                <DataTable<Invoice>
                  key={`${needle}|${type}`}
                  rows={invoices}
                  rowKey={(invoice, index) => invoice.FIC || invoice.IIC || String(index)}
                  sort={sort}
                  onSort={(key) => setSort(toggle(sort, key, key === "party"))}
                  onRowClick={(invoice) => setOpened({ type: "invoice", invoice })}
                  columns={[
                    {
                      label: t("col.date"),
                      sortKey: "date",
                      render: (invoice) => formatDate(invoice.IssueDateTime),
                    },
                    {
                      label: t("col.number"),
                      sortKey: "number",
                      render: (invoice) => (
                        <TwoLines
                          title={invoiceNumber(invoice)}
                          detail={!invoice.InvNum ? invoice.TCRCode : undefined}
                        />
                      ),
                    },
                    {
                      label: t(isSales ? "col.buyer" : "col.seller"),
                      sortKey: "party",
                      grow: true,
                      render: (invoice) => <PartyCell invoice={invoice} kind={kind} />,
                    },
                    { label: t("col.type"), render: (invoice) => <TypeBadges invoice={invoice} /> },
                    {
                      label: t("col.net"),
                      sortKey: "net",
                      align: "right",
                      render: (invoice) => money(netAmount(invoice)),
                    },
                    {
                      label: t("col.vat"),
                      sortKey: "vat",
                      align: "right",
                      render: (invoice) => money(invoice.TotVATAmt),
                    },
                    {
                      label: t("col.total"),
                      sortKey: "total",
                      align: "right",
                      render: (invoice) => (
                        <Text size="sm" fw={700}>
                          {money(invoice.TotPrice)}
                        </Text>
                      ),
                    },
                  ]}
                />
              )}
            </Stack>
          ) : progress.loading ? (
            <ItemsProgress progress={progress} onStop={details.stop} />
          ) : (
            <Stack gap="sm">
              {progress.error !== null && <ErrorBox error={progress.error} />}
              {missing > 0 && (
                <Alert color="yellow" variant="light">
                  <Group justify="space-between" gap="sm">
                    <Text size="sm">
                      {t("items.partial", {
                        done: fetched.invoices.filter((invoice) => invoice.FIC).length - missing,
                        total: fetched.invoices.filter((invoice) => invoice.FIC).length,
                      })}
                    </Text>
                    <Button
                      size="xs"
                      variant="default"
                      leftSection={<IconRefresh size={14} />}
                      onClick={() => void load(fetched.invoices)}
                    >
                      {t("items.continue")}
                    </Button>
                  </Group>
                </Alert>
              )}
              <Stats
                count={new Set(lines.map(({ invoice }) => invoice.FIC)).size}
                of={fetched.invoices.length}
                net={sum(lines.map(({ item }) => item.PB))}
                vat={sum(lines.map(({ item }) => item.VA))}
                total={sum(lines.map(({ item }) => item.PA))}
              />
              <Text size="sm" c="dimmed">
                {t("inv.periodLabel", {
                  from: formatDate(fetched.from, false),
                  to: formatDate(fetched.to, false),
                })}
              </Text>
              {!summary.length ? (
                <Empty>{fetched.invoices.length ? t("items.empty") : t("inv.empty")}</Empty>
              ) : (
                <DataTable<ItemSummary>
                  key={`${needle}|${type}`}
                  rows={summary}
                  rowKey={(row) => row.key}
                  sort={itemSort}
                  onSort={(key) => setItemSort(toggle(itemSort, key, key === "name"))}
                  onRowClick={(row) => setOpened({ type: "item", row })}
                  columns={[
                    {
                      label: t("col.item"),
                      sortKey: "name",
                      grow: true,
                      render: (row) => <TwoLines title={row.ItemName} detail={shortCodes(row.ItemCode)} />,
                    },
                    { label: t("col.unit"), render: (row) => row.Unit },
                    {
                      label: t("col.qty"),
                      sortKey: "qty",
                      align: "right",
                      render: (row) => quantity(row.Quantity),
                    },
                    {
                      label: t("col.net"),
                      sortKey: "net",
                      align: "right",
                      render: (row) => money(row.PriceWoVAT),
                    },
                    {
                      label: t("col.vat"),
                      sortKey: "vat",
                      align: "right",
                      render: (row) => money(row.VATAmt),
                    },
                    {
                      label: t("col.total"),
                      sortKey: "total",
                      align: "right",
                      render: (row) => (
                        <Text size="sm" fw={700}>
                          {money(row.Price)}
                        </Text>
                      ),
                    },
                    {
                      label: t("col.invoices"),
                      sortKey: "invoices",
                      align: "right",
                      render: (row) => row.Invoices,
                    },
                  ]}
                />
              )}
            </Stack>
          )}
        </>
      )}

      {opened?.type === "invoice" && (
        <InvoiceDialog
          key={opened.invoice.FIC}
          kind={kind}
          invoice={opened.invoice}
          details={details}
          onClose={() => setOpened(null)}
        />
      )}
      {opened?.type === "item" && (
        <ItemLinesDialog
          kind={kind}
          row={opened.row}
          lines={lines.filter(({ item }) => itemKey(item) === opened.row.key)}
          onOpenInvoice={(invoice) => setOpened({ type: "invoice", invoice })}
          onClose={() => setOpened(null)}
        />
      )}
    </Stack>
  );
}
