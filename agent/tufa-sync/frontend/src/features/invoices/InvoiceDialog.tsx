import { Button, Group, Loader, Modal, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconBraces, IconDownload, IconExternalLink, IconFileTypePdf } from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { API, ApiError, invoicesPath } from "../../api";
import { DataTable } from "../../components/DataTable";
import { Code, Copyable, ErrorBox, Facts, type Fact } from "../../components/ui";
import { useI18n } from "../../i18n";
import { base64ToBytes, download, fileName } from "../../lib/files";
import { formatDate, money, quantity } from "../../lib/format";
import { invoiceNumber, netAmount, verificationUrl } from "../../lib/invoice";
import { unitOf } from "../../lib/units";
import { invoicesDocument, paymentLabel } from "../../pdf/invoice";
import { makePdf } from "../../pdf/pdfmake";
import type { Invoice, Kind, Party } from "../../types";
import { useApi, useBusiness } from "../session/context";
import { TypeBadges } from "./parts";
import type { InvoiceDetails } from "./useInvoiceDetails";

function PartyCard({ title, party }: { title: string; party?: Party }) {
  if (!party) return null;
  const address = [party.Address, party.Town, party.Country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  return (
    <Paper p="md">
      <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts={0.6}>
        {title}
      </Text>
      <Text fw={600} mt={4}>
        {party.Name || "—"}
      </Text>
      {party.IDNum && (
        <Text size="sm">
          {!party.IDType || party.IDType === "NUIS" ? "NIPT" : party.IDType}: <Code value={party.IDNum} />
        </Text>
      )}
      {address && (
        <Text size="sm" c="dimmed">
          {address}
        </Text>
      )}
    </Paper>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap="xs">
      <Title order={4}>{title}</Title>
      {children}
    </Stack>
  );
}

/** One invoice in full. Opened from a list it shows what the list has, then the complete invoice fetched by FIC. */
export function InvoiceDialog({
  kind,
  invoice: listed,
  details,
  onClose,
}: {
  kind: Kind;
  invoice: Invoice;
  details: InvoiceDetails;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const call = useApi();
  const business = useBusiness();
  const { remember } = details;
  const [invoice, setInvoice] = useState<Invoice>(
    () => (listed.FIC && details.current().get(listed.FIC)) || listed,
  );
  const [loading, setLoading] = useState(!invoice.Items && Boolean(listed.FIC));
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<"pdf" | "official" | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  useEffect(() => {
    if (!loading || !listed.FIC) return;
    let current = true;
    call<Invoice[]>(invoicesPath(kind), { FIC: listed.FIC })
      .then((found) => {
        if (!current || !found[0]) return;
        remember(found[0]);
        setInvoice(found[0]);
      })
      .catch((reason: unknown) => {
        if (current) setError(reason);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [call, remember, kind, listed.FIC, loading]);

  const run = async (action: "pdf" | "official", work: () => Promise<void>) => {
    setBusy(action);
    setActionError(null);
    try {
      await work();
    } catch (reason) {
      setActionError(reason);
    } finally {
      setBusy(null);
    }
  };

  const simplePdf = () =>
    run("pdf", async () => {
      const number = invoiceNumber(invoice);
      const document = invoicesDocument(
        [invoice],
        { t, lang, environment: business.environment },
        `${t("pdf.invoice")} ${number}`,
      );
      download(`${fileName(t("pdf.invoice"), number)}.pdf`, await makePdf(document));
    });

  // The tax authority's own PDF; it exists for e-invoices only.
  const officialPdf = () =>
    run("official", async () => {
      try {
        const { base64 } = await call<{ base64: string }>(`${API}/einvoice-pdf`, {
          EIC: invoice.EIC,
          PartyType: kind === "SALES" ? "SELLER" : "BUYER",
        });
        const name = `${fileName(t("pdf.invoice"), invoiceNumber(invoice) || invoice.EIC)}.pdf`;
        download(name, new Blob([base64ToBytes(base64) as BlobPart], { type: "application/pdf" }));
      } catch (reason) {
        throw reason instanceof ApiError && reason.status === 404
          ? new ApiError(404, { message: t("error.noPdf") })
          : reason;
      }
    });

  const verify = verificationUrl(invoice, business.environment);
  const supply = invoice.SupplyDateOrPeriod;
  const currency = invoice.Currency;
  const code = (value?: string) => (value ? <Code value={value} /> : null);
  const facts: Fact[] = [
    [t("detail.issued"), formatDate(invoice.IssueDateTime)],
    [t("detail.registered"), formatDate(invoice.SendDateTime)],
    [
      t("detail.paymentType"),
      invoice.TypeOfInv ? t(invoice.TypeOfInv === "CASH" ? "type.CASH" : "type.NONCASH") : "",
    ],
    [t("detail.deadline"), formatDate(invoice.PayDeadline, false)],
    [
      t("detail.currency"),
      currency?.Code && currency.Code !== "ALL" ? `${currency.Code} · ${currency.ExRate ?? ""}` : "",
    ],
    [
      t("detail.supply"),
      supply ? `${formatDate(supply.Start, false)} – ${formatDate(supply.End, false)}` : "",
    ],
    [t("detail.unit"), code(invoice.BusinUnitCode)],
    [t("detail.tcr"), code(invoice.TCRCode)],
    [t("detail.operator"), code(invoice.OperatorCode)],
    [t("detail.software"), code(invoice.SoftCode)],
    [
      t("detail.inVat"),
      invoice.IsIssuerInVAT === "true"
        ? t("common.yes")
        : invoice.IsIssuerInVAT === "false"
          ? t("common.no")
          : "",
    ],
    [t("detail.simplified"), invoice.IsSimplifiedInv === "true" ? t("common.yes") : ""],
    [t("detail.reverse"), invoice.IsReverseCharge === "true" ? t("common.yes") : ""],
    [t("detail.selfIssue"), invoice.TypeOfSelfIss],
    [t("detail.customs"), invoice.ImpCustDecNum],
  ];
  const codes = (
    [
      ["NIVF · FIC", invoice.FIC],
      ["NSLF · IIC", invoice.IIC],
      ["EIC", invoice.EIC],
    ] satisfies [string, string | undefined][]
  ).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const reference = (ref?: { IICRef?: string; IssueDateTime?: string }) =>
    ref && (
      <Group gap={6}>
        <Code value={ref.IICRef} /> · {formatDate(ref.IssueDateTime)}
      </Group>
    );
  const references: Fact[] = [
    [t("detail.corrects", { type: invoice.CorrectiveInv?.Type ?? "" }), reference(invoice.CorrectiveInv)],
    [t("detail.badDebt"), reference(invoice.BadDebtInv)],
    ...(invoice.SumInvIICRefs ?? []).map((ref, index): Fact => [
      `${t("detail.summarises")} ${index + 1}`,
      reference({ IICRef: ref.IIC, IssueDateTime: ref.IssueDateTime }),
    ]),
  ];

  return (
    <Modal
      opened
      onClose={onClose}
      size={1120}
      title={
        <Group gap="sm">
          <Text fw={700} fz={22}>
            {t("detail.title", { number: invoiceNumber(invoice) })}
          </Text>
          <TypeBadges invoice={invoice} />
        </Group>
      }
    >
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end" gap="md">
          <Group gap="xs">
            <Button
              size="sm"
              leftSection={<IconFileTypePdf size={16} />}
              disabled={!invoice.Items || busy !== null}
              loading={busy === "pdf"}
              onClick={() => void simplePdf()}
            >
              {t("detail.invoicePdf")}
            </Button>
            {invoice.EIC && (
              <Button
                size="sm"
                variant="default"
                leftSection={<IconDownload size={16} />}
                disabled={busy !== null}
                loading={busy === "official"}
                onClick={() => void officialPdf()}
              >
                {t("detail.pdf")}
              </Button>
            )}
            {verify && (
              <Button
                size="sm"
                variant="default"
                component="a"
                href={verify}
                target="_blank"
                rel="noopener noreferrer"
                leftSection={<IconExternalLink size={16} />}
              >
                {t("detail.verify")}
              </Button>
            )}
            <CopyJson invoice={invoice} />
          </Group>
          <Stack gap={0} align="flex-end">
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts={0.6}>
              {t("stats.total")} (ALL)
            </Text>
            <Text fz={30} fw={750} lh={1.15}>
              {money(invoice.TotPrice)}
            </Text>
          </Stack>
        </Group>
        {actionError !== null && <ErrorBox error={actionError} />}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <PartyCard title={t("col.seller")} party={invoice.Seller} />
          <PartyCard title={t("col.buyer")} party={invoice.Buyer} />
        </SimpleGrid>

        <Facts entries={facts} />

        {codes.length > 0 && (
          <Paper p="md">
            <SimpleGrid cols={{ base: 1, md: codes.length }} spacing="lg">
              {codes.map(([label, value]) => (
                <Stack key={label} gap={2}>
                  <Text size="xs" fw={600} c="dimmed">
                    {label}
                  </Text>
                  <Copyable value={value} />
                </Stack>
              ))}
            </SimpleGrid>
          </Paper>
        )}

        {loading && (
          <Group gap="sm">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              {t("detail.loadingItems")}
            </Text>
          </Group>
        )}
        {error !== null && <ErrorBox error={error} />}

        {invoice.Items && invoice.Items.length > 0 && (
          <Section title={t("detail.items")}>
            <DataTable
              rows={invoice.Items}
              rowKey={(_, index) => String(index)}
              minWidth={900}
              columns={[
                {
                  label: t("item.name"),
                  grow: true,
                  render: (item) => (
                    <div>
                      <Text size="sm">{item.N}</Text>
                      {item.C && (
                        <Text size="xs" c="dimmed" ff="monospace">
                          {item.C}
                        </Text>
                      )}
                    </div>
                  ),
                },
                { label: t("item.unit"), render: (item) => unitOf(item.U, lang).label },
                { label: t("item.qty"), align: "right", render: (item) => quantity(item.Q) },
                { label: t("item.upb"), align: "right", render: (item) => money(item.UPB) },
                { label: t("item.upa"), align: "right", render: (item) => money(item.UPA) },
                {
                  label: t("item.discount"),
                  align: "right",
                  render: (item) => (Number(item.R) ? quantity(item.R) : ""),
                },
                {
                  label: t("item.vatRate"),
                  align: "right",
                  render: (item) => (item.EX ? item.EX : item.VR !== undefined ? quantity(item.VR) : ""),
                },
                { label: t("item.net"), align: "right", render: (item) => money(item.PB) },
                { label: t("item.vat"), align: "right", render: (item) => money(item.VA) },
                {
                  label: t("item.total"),
                  align: "right",
                  render: (item) => (
                    <Text size="sm" fw={700}>
                      {money(item.PA)}
                    </Text>
                  ),
                },
              ]}
            />
          </Section>
        )}

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <Section title={t("detail.totals")}>
            <Paper p="md">
              <Facts
                cols={{ base: 2 }}
                entries={[
                  [t("stats.net"), money(netAmount(invoice))],
                  [t("stats.vat"), money(invoice.TotVATAmt)],
                  [t("detail.taxFree"), Number(invoice.TaxFreeAmt) ? money(invoice.TaxFreeAmt) : ""],
                  [t("detail.markUp"), Number(invoice.MarkUpAmt) ? money(invoice.MarkUpAmt) : ""],
                  [t("detail.export"), Number(invoice.GoodsExAmt) ? money(invoice.GoodsExAmt) : ""],
                  [
                    t("stats.total"),
                    <Text key="total" fw={700} size="sm">
                      {money(invoice.TotPrice)}
                    </Text>,
                  ],
                ]}
              />
              <Text size="xs" c="dimmed" mt="sm">
                {t("detail.allAmounts")}
              </Text>
            </Paper>
          </Section>
          {invoice.PayMethods && invoice.PayMethods.length > 0 && (
            <Section title={t("detail.payments")}>
              <DataTable
                rows={invoice.PayMethods}
                rowKey={(_, index) => String(index)}
                minWidth={0}
                columns={[
                  {
                    label: t("pay.method"),
                    grow: true,
                    render: (pay) => [paymentLabel(pay.Type, t), pay.CompCard].filter(Boolean).join(" · "),
                  },
                  { label: t("pay.amount"), align: "right", render: (pay) => money(pay.Amt) },
                ]}
              />
            </Section>
          )}
        </SimpleGrid>

        {invoice.SameTaxes && invoice.SameTaxes.length > 0 && (
          <Section title={t("detail.taxes")}>
            <DataTable
              rows={invoice.SameTaxes}
              rowKey={(_, index) => String(index)}
              minWidth={0}
              columns={[
                {
                  label: t("tax.rate"),
                  grow: true,
                  render: (tax) => (tax.ExemptFromVAT ? tax.ExemptFromVAT : `${quantity(tax.VATRate)} %`),
                },
                { label: t("tax.items"), align: "right", render: (tax) => tax.NumOfItems ?? "" },
                { label: t("tax.base"), align: "right", render: (tax) => money(tax.PriceBefVAT) },
                { label: t("tax.vat"), align: "right", render: (tax) => money(tax.VATAmt) },
              ]}
            />
          </Section>
        )}

        {invoice.Fees && invoice.Fees.length > 0 && (
          <Section title={t("detail.fees")}>
            <Facts
              entries={invoice.Fees.map((fee, index): Fact => [
                fee.Type || String(index + 1),
                money(fee.Amt),
              ])}
            />
          </Section>
        )}

        {references.some(([, value]) => Boolean(value)) && (
          <Section title={t("detail.references")}>
            <Facts entries={references} cols={{ base: 1, md: 2 }} />
          </Section>
        )}
      </Stack>
    </Modal>
  );
}

function CopyJson({ invoice }: { invoice: Invoice }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="subtle"
      color={copied ? "teal" : "gray"}
      leftSection={<IconBraces size={16} />}
      onClick={() => {
        navigator.clipboard.writeText(JSON.stringify(invoice, null, 2)).then(
          () => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          },
          () => {},
        );
      }}
    >
      {copied ? t("common.copied") : t("detail.json")}
    </Button>
  );
}
