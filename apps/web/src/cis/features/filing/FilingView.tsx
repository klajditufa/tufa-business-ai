/*
 * FilingView i cis-client-2 (frontend/src/features/filing/FilingView.tsx), i përshtatur për TUFA:
 * lidhja me portalin bëhet me shtesën "TUFA · e-Filing" (në vend të shfletuesit lokal / çiftimit me kod),
 * prandaj seksioni "Të avancuara" tregon instalimin e shtesës. Pjesa tjetër është e njëjtë.
 */
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  NativeSelect,
  Paper,
  PasswordInput,
  ScrollArea,
  SimpleGrid,
  Grid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { IconDownload, IconExternalLink, IconFileDescription } from "@tabler/icons-react";
import { useState, type ReactNode } from "react";
import { PageHead } from "../../components/PageHead";
import { Empty, ErrorBox } from "../../components/ui";
import { maybeKey, useI18n } from "../../i18n";
import { download, fileName } from "../../lib/files";
import { makePdf } from "../../pdf/pdfmake";
import { useBusiness } from "../session/context";
import { CredentialsFields, emptyCredentials } from "./CredentialsFields";
import type { FilingState, PortalField, PortalSnapshot } from "./types";
import { useFilingState } from "./useFilingState";
import { ManagedBrowserPanel } from "./ManagedBrowserPanel";
import { PortalNavigation } from "./PortalNavigation";
import { portalTableCsv, portalTableDocument } from "./reports";

type Mutate = (path: string, body?: unknown, method?: "POST" | "DELETE") => Promise<FilingState | null>;

function PortalInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: PortalField;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const props = { label: field.label, disabled: disabled || field.readOnly };
  if (field.type === "checkbox" || field.type === "radio") {
    return (
      <Checkbox
        {...props}
        checked={value === "true"}
        onChange={(event) => onChange(String(event.currentTarget.checked))}
      />
    );
  }
  if (field.type === "select") {
    return (
      <NativeSelect
        {...props}
        value={value}
        data={field.options}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  }
  if (field.type === "textarea") {
    return (
      <Textarea
        {...props}
        value={value}
        autosize
        minRows={2}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  }
  return <TextInput {...props} value={value} onChange={(event) => onChange(event.currentTarget.value)} />;
}

function PortalDraft({
  snapshot,
  state,
  mutate,
  busy,
}: {
  snapshot: PortalSnapshot;
  state: FilingState;
  mutate: Mutate;
  busy: boolean;
}) {
  const { t, lang } = useI18n();
  const [form, setForm] = useState("0");
  const [search, setSearch] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);
  const [exporting, setExporting] = useState<number | null>(null);
  const allFields = snapshot.forms.flatMap((entry) => entry.fields);
  const fields = snapshot.forms[Number(form)]?.fields ?? [];
  const changed = allFields.filter((field) => field.key in edits && edits[field.key] !== field.value);
  const reviewMatches =
    state.review?.revision === snapshot.revision &&
    JSON.stringify(Object.entries(state.review.edits).sort()) ===
      JSON.stringify(Object.entries(edits).sort());

  const change = (field: PortalField, value: string) => {
    setConfirmed(false);
    setEdits((previous) => {
      const next = { ...previous };
      if (value === field.value)
        return Object.fromEntries(Object.entries(next).filter(([key]) => key !== field.key));
      else next[field.key] = value;
      return next;
    });
  };

  async function exportPdf(index: number) {
    setExporting(index);
    setExportError(null);
    try {
      download(
        `${fileName("e-Filing", snapshot.nipt, String(index + 1))}.pdf`,
        await makePdf(portalTableDocument(snapshot, index, t)),
      );
    } catch (reason) {
      setExportError(reason);
    } finally {
      setExporting(null);
    }
  }

  return (
    <Paper p={{ base: "sm", sm: "lg" }}>
      <Stack gap="md">
        <Group justify="space-between">
          <Stack gap={2}>
            <Title order={3} fz="lg">
              {snapshot.title || t("filing.snapshot")}
            </Title>
            <Text size="sm" c="dimmed">
              {snapshot.nipt} ·{" "}
              {t("filing.captured", { time: new Date(snapshot.capturedAt * 1000).toLocaleString(lang) })}
            </Text>
          </Stack>
          <Button
            variant="default"
            leftSection={<IconDownload size={16} />}
            onClick={() =>
              download(
                `${fileName("e-Filing", snapshot.nipt)}.json`,
                JSON.stringify({ snapshot, reviewedDraft: state.review, edits }, null, 2),
                "application/json",
              )
            }
          >
            {t("filing.export")}
          </Button>
        </Group>
        {snapshot.forms.length > 0 && (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <NativeSelect
                label={t("filing.form")}
                value={form}
                onChange={(event) => setForm(event.currentTarget.value)}
                data={snapshot.forms.map((entry, index) => ({ value: String(index), label: entry.title }))}
              />
              <TextInput
                label={t("filing.search")}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
              />
            </SimpleGrid>
            <ScrollArea.Autosize mah={560} offsetScrollbars>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" p={2}>
                {fields
                  .filter((field) => field.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
                  .map((field) => (
                    <PortalInput
                      key={field.key}
                      field={field}
                      value={edits[field.key] ?? field.value}
                      onChange={(value) => change(field, value)}
                      disabled={busy}
                    />
                  ))}
              </SimpleGrid>
            </ScrollArea.Autosize>
          </>
        )}
        {snapshot.tables.length > 0 && (
          <Accordion variant="separated" defaultValue="tables">
            <Accordion.Item value="tables">
              <Accordion.Control>{t("filing.tables", { n: snapshot.tables.length })}</Accordion.Control>
              <Accordion.Panel>
                <Stack>
                  {snapshot.tables.map((rows, index) => (
                    <Stack gap="xs" key={index}>
                      <Group justify="space-between">
                        <Text fw={600} size="sm">
                          {t("filing.table", { n: index + 1 })}
                        </Text>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="default"
                            disabled={!rows.length}
                            onClick={() =>
                              download(
                                `${fileName("e-Filing", snapshot.nipt, String(index + 1))}.csv`,
                                portalTableCsv(rows, t),
                              )
                            }
                          >
                            {t("export.csv")}
                          </Button>
                          <Button
                            size="xs"
                            variant="default"
                            loading={exporting === index}
                            disabled={!rows.length || exporting !== null}
                            onClick={() => void exportPdf(index)}
                          >
                            {t("pdf.menu")}
                          </Button>
                        </Group>
                      </Group>
                      <ScrollArea.Autosize mah={400} offsetScrollbars>
                        <Table striped withTableBorder fz="xs">
                          <Table.Tbody>
                            {rows.map((row, ri) => (
                              <Table.Tr key={ri}>
                                {row.map((cell, ci) => (
                                  <Table.Td key={ci} miw={100}>
                                    {cell}
                                  </Table.Td>
                                ))}
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </ScrollArea.Autosize>
                    </Stack>
                  ))}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        )}
        {exportError !== null && <ErrorBox error={exportError} />}
        {snapshot.forms.length > 0 && (
          <>
            <Checkbox
              label={t("filing.confirm")}
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.currentTarget.checked)}
            />
            <Group>
              <Button
                disabled={!confirmed || busy}
                onClick={() =>
                  void mutate("review", {
                    revision: snapshot.revision,
                    edits,
                    confirmed,
                  })
                }
              >
                {t("filing.review")}
              </Button>
            </Group>
          </>
        )}
        {reviewMatches && (
          <Stack gap="sm">
            <Text fw={600}>{t("filing.reviewed", { n: changed.length })}</Text>
            {changed.length ? (
              <ScrollArea>
                <Table withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t("filing.field")}</Table.Th>
                      <Table.Th>{t("filing.before")}</Table.Th>
                      <Table.Th>{t("filing.after")}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {changed.map((field) => (
                      <Table.Tr key={field.key}>
                        <Table.Td>{field.label}</Table.Td>
                        <Table.Td style={{ overflowWrap: "anywhere" }}>{field.value}</Table.Td>
                        <Table.Td style={{ overflowWrap: "anywhere" }}>{edits[field.key]}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            ) : (
              <Text size="sm">{t("filing.noChanges")}</Text>
            )}
            <Text size="sm" c="dimmed">
              {t("filing.applyHelp")}
            </Text>
            <Group>
              {changed.length > 0 && (
                <Button
                  disabled={!state.connected || busy || !confirmed}
                  onClick={() => void mutate("apply", { reviewId: state.review?.id })}
                >
                  {t("filing.apply")}
                </Button>
              )}
              {state.connectionKind === "extension" && (
                <Button
                  variant="default"
                  disabled={!state.connected || busy}
                  onClick={() => void mutate("command", { kind: "focus" })}
                >
                  {t("filing.focus")}
                </Button>
              )}
            </Group>
          </Stack>
        )}
        <Text size="xs" c="dimmed">
          {t("filing.manual")}
        </Text>
      </Stack>
    </Paper>
  );
}

export function FilingView({ extra }: { extra?: (snapshot: PortalSnapshot) => ReactNode } = {}) {
  const { t } = useI18n();
  const business = useBusiness();
  const {
    state,
    browser,
    error: connectionError,
    stale,
    working,
    mutate,
    browserAction,
    extension,
    minExtension,
  } = useFilingState(business.id);
  const [error] = useState<unknown>(null);
  const [values, setValues] = useState(emptyCredentials);
  const [editingCredentials, setEditingCredentials] = useState(false);
  const [passphrase, setPassphrase] = useState("");

  const busy = working || stale || Boolean(state?.command);
  return (
    <Stack gap="md">
      <PageHead
        icon={IconFileDescription}
        tone="overview"
        title={t("tabs.filing")}
        description={t("filing.lead")}
        actions={
          <Button
            component="a"
            href="https://efiling.tatime.gov.al/cats_public/"
            target="_blank"
            rel="noopener noreferrer"
            variant="default"
            leftSection={<IconExternalLink size={16} />}
          >
            {t("filing.open")}
          </Button>
        }
      />

      {error !== null && <ErrorBox error={error} />}
      {connectionError !== null && <ErrorBox error={connectionError} />}
      <Stack gap="sm">
        <Accordion
          variant="contained"
          key={String(state?.configured)}
          defaultValue={state?.configured ? undefined : "credentials"}
        >
          <Accordion.Item value="credentials">
            <Accordion.Control>
              <Group gap="sm">
                <Text size="sm" fw={600}>
                  {t("filing.credentials")}
                </Text>
                {state?.configured && (
                  <Badge color="teal" variant="light">
                    {state.username}
                  </Badge>
                )}
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="md">
                {state?.configured && !editingCredentials ? (
                  <>
                    <Alert color="teal">
                      {t("filing.saved")} {state.username}
                    </Alert>
                    <Button
                      variant="light"
                      disabled={busy}
                      onClick={() => {
                        setValues({ ...emptyCredentials(), username: state.username || business.nipt || "" });
                        setEditingCredentials(true);
                      }}
                    >
                      {t("filing.editCredentials")}
                    </Button>
                    <Button
                      variant="default"
                      color="red"
                      disabled={busy}
                      onClick={() => void mutate("credentials", undefined, "DELETE")}
                    >
                      {t("filing.forget")}
                    </Button>
                  </>
                ) : (
                  <>
                    {state?.remembered && !state.configured && (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void mutate("unlock", { passphrase }).then((result) => {
                            if (result) setPassphrase("");
                          });
                        }}
                      >
                        <Stack gap="sm">
                          <Text size="sm">{t("filing.locked")}</Text>
                          <PasswordInput
                            label={t("filing.passphrase")}
                            value={passphrase}
                            required
                            autoComplete="off"
                            onChange={(event) => setPassphrase(event.currentTarget.value)}
                          />
                          <Button type="submit" loading={working}>
                            {t("filing.unlock")}
                          </Button>
                        </Stack>
                      </form>
                    )}
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void mutate("credentials", values).then((result) => {
                          if (result) {
                            setValues(emptyCredentials());
                            setEditingCredentials(false);
                          }
                        });
                      }}
                    >
                      <Stack gap="md">
                        <CredentialsFields value={values} onChange={setValues} disabled={busy} />
                        <Button type="submit" loading={working} disabled={busy}>
                          {t("filing.save")}
                        </Button>
                        {editingCredentials && (
                          <Button
                            variant="subtle"
                            disabled={busy}
                            onClick={() => {
                              setValues(emptyCredentials());
                              setEditingCredentials(false);
                            }}
                          >
                            {t("filing.cancelEdit")}
                          </Button>
                        )}
                      </Stack>
                    </form>
                    {state?.remembered && (
                      <Button
                        variant="subtle"
                        color="red"
                        disabled={busy}
                        onClick={() => void mutate("credentials", undefined, "DELETE")}
                      >
                        {t("filing.forget")}
                      </Button>
                    )}
                  </>
                )}
                <Accordion>
                  <Accordion.Item value="connection-options">
                    <Accordion.Control>{t("filing.advancedConnection")}</Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        <Text size="sm">{t("filing.tufaBrowserHelp")}</Text>
                        <Group>
                          <Button
                            component="a"
                            href="/tufa-efiling.zip"
                            download
                            variant="default"
                            leftSection={<IconDownload size={16} />}
                          >
                            {t("filing.install")}
                          </Button>
                          {extension && (
                            <Badge color={extension.current ? "teal" : "yellow"} variant="light">
                              {extension.current
                                ? t("filing.extensionReady", { version: extension.version })
                                : t("filing.extensionOld", { have: extension.version, need: minExtension })}
                            </Badge>
                          )}
                        </Group>
                        <Text size="sm" c="dimmed">
                          {t("filing.installHelp")}
                        </Text>
                        <Group>
                          <Button variant="subtle" disabled={working} onClick={() => void mutate("disconnect")}>
                            {t("filing.disconnect")}
                          </Button>
                        </Group>
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion>{" "}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
        {state?.connectionKind === "extension" ? (
          <Badge color={state.connected ? "teal" : "gray"}>
            {t(state.connected ? "filing.connected" : "filing.disconnected")}
          </Badge>
        ) : (
          <ManagedBrowserPanel
            state={browser}
            snapshot={state?.snapshot ?? null}
            configured={state?.configured ?? false}
            unavailable={stale}
            disabled={busy}
            onAction={browserAction}
          />
        )}
      </Stack>
      <Stack gap="sm">
        <Group>
          <Button
            disabled={busy || !state?.connected}
            onClick={() => void mutate("command", { kind: "capture" })}
          >
            {t("filing.capture")}
          </Button>
          {state?.connectionKind !== "managed" && (
            <Button
              variant="default"
              disabled={busy || !state?.connected}
              onClick={() => void mutate("command", { kind: "focus" })}
            >
              {t("filing.focus")}
            </Button>
          )}
        </Group>
        {state?.command && (
          <Text size="sm" c="dimmed" role="status">
            {t("filing.pending")}
          </Text>
        )}
        {state?.outcome && !state.outcome.ok && (
          <Alert color="red">
            {t(maybeKey(`filing.outcome.${state.outcome.code}`) ?? "filing.outcome.unknown")}
          </Alert>
        )}
      </Stack>
      {state?.snapshot && extra?.(state.snapshot)}
      {state?.snapshot ? (
        <Grid gap="lg">
          {state.connectionKind === "managed" && (
            <Grid.Col span={{ base: 12, md: 3 }}>
              <PortalNavigation
                snapshot={state.snapshot}
                busy={busy || !state.connected}
                onNavigate={(key) => void mutate("navigate", { revision: state.snapshot?.revision, key })}
              />
            </Grid.Col>
          )}
          <Grid.Col
            span={{ base: 12, md: state.connectionKind === "managed" ? 9 : 12 }}
            style={{ minWidth: 0 }}
          >
            <PortalDraft
              key={state.snapshot.revision}
              snapshot={state.snapshot}
              state={state}
              mutate={mutate}
              busy={busy}
            />
          </Grid.Col>
        </Grid>
      ) : (
        <Empty>{t(state?.configured ? "filing.noCapture" : "filing.credentialsHelp")}</Empty>
      )}
      <Text size="xs" c="dimmed">
        {t("filing.limit")}
      </Text>
    </Stack>
  );
}
