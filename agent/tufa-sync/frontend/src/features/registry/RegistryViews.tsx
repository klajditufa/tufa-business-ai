// Lists from the CIS registry: taxpayers (any business), and this business's operators, units and devices.
import { Button, Center, Group, Loader, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { IconBuildingStore, IconRefresh, IconSearch, IconUsers, type Icon } from "@tabler/icons-react";
import { useState, type ReactNode } from "react";
import { API } from "../../api";
import { DataTable } from "../../components/DataTable";
import { PageHead } from "../../components/PageHead";
import { Code, Copyable, Empty, ErrorBox, StatusBadge } from "../../components/ui";
import { useI18n } from "../../i18n";
import { formatDate, isActive } from "../../lib/format";
import type { BusinessUnit, Operator, Taxpayer, Tcr } from "../../types";
import { useApi } from "../session/context";
import { useLoad } from "./useLoad";

export function TaxpayersView() {
  const { t } = useI18n();
  const call = useApi();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Taxpayer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function search() {
    if (term.trim().length < 3 || loading) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await call<Taxpayer[]>(`${API}/get-taxpayers`, { searchTerm: term.trim() }));
    } catch (reason) {
      setError(reason);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack gap="md">
      <PageHead icon={IconSearch} tone="registry" title={t("tabs.taxpayers")} description={t("tp.lead")} />
      <Paper p={{ base: "sm", sm: "md" }}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
        >
          <Group align="flex-end" gap="sm">
            <TextInput
              label={`${t("col.nipt")} / ${t("col.name")}`}
              placeholder={t("tp.placeholder")}
              leftSection={<IconSearch size={16} stroke={1.8} />}
              value={term}
              onChange={(event) => setTerm(event.currentTarget.value)}
              minLength={3}
              maxLength={100}
              required
              autoComplete="off"
              style={{ flex: 1 }}
            />
            <Button type="submit" loading={loading}>
              {t("tp.search")}
            </Button>
          </Group>
          <Text size="xs" c="dimmed" mt="xs">
            {t("tp.note")}
          </Text>
        </form>
      </Paper>
      {error !== null ? (
        <ErrorBox error={error} />
      ) : !results ? (
        <Empty>{t("tp.initial")}</Empty>
      ) : !results.length ? (
        <Empty>{t("tp.empty")}</Empty>
      ) : (
        <DataTable<Taxpayer>
          rows={results}
          rowKey={(row) => row.Tin}
          columns={[
            { label: t("col.nipt"), render: (row) => <Copyable value={row.Tin} /> },
            {
              label: t("col.name"),
              grow: true,
              render: (row) => (
                <Text size="sm" fw={600}>
                  {row.Name}
                </Text>
              ),
            },
            { label: t("col.address"), grow: true, render: (row) => row.Address },
            { label: t("col.town"), render: (row) => row.Town },
            { label: t("col.country"), render: (row) => row.Country },
          ]}
        />
      )}
    </Stack>
  );
}

/** A registry page: heading with a refresh button, then the lists once loaded. */
function ListView({
  icon,
  title,
  description,
  loading,
  error,
  reload,
  children,
}: {
  icon: Icon;
  title: string;
  description: string;
  loading: boolean;
  error: unknown;
  reload: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <Stack gap="md">
      <PageHead
        icon={icon}
        tone="registry"
        title={title}
        description={description}
        actions={
          <Button
            variant="default"
            size="sm"
            leftSection={<IconRefresh size={16} />}
            loading={loading}
            onClick={reload}
          >
            {t("common.refresh")}
          </Button>
        }
      />
      {error !== null && <ErrorBox error={error} />}
      {loading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : (
        children
      )}
    </Stack>
  );
}

export function OperatorsView() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useLoad((call) => call<Operator[]>(`${API}/get-operators`));
  return (
    <ListView
      icon={IconUsers}
      title={t("tabs.operators")}
      description={t("op.lead")}
      loading={loading}
      error={error}
      reload={() => void reload()}
    >
      {data &&
        (data.length ? (
          <DataTable<Operator>
            rows={data}
            rowKey={(row) => row.opCode}
            columns={[
              {
                label: t("col.name"),
                grow: true,
                render: (row) => (
                  <Text size="sm" fw={600}>
                    {row.name}
                  </Text>
                ),
              },
              { label: t("op.code"), render: (row) => <Copyable value={row.opCode} /> },
              { label: t("op.id"), render: (row) => <Code value={row.idNumber} /> },
              { label: t("op.validFrom"), render: (row) => formatDate(row.validFrom, false) },
              {
                label: t("op.validTo"),
                value: (row) => row.validTo,
                render: (row) => formatDate(row.validTo, false),
              },
              {
                label: t("op.status"),
                render: (row) => <StatusBadge active={isActive(row.validFrom, row.validTo)} />,
              },
            ]}
          />
        ) : (
          <Empty>{t("op.empty")}</Empty>
        ))}
    </ListView>
  );
}

export function UnitsView() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useLoad((call) =>
    Promise.all([call<BusinessUnit[]>(`${API}/get-business-units`), call<Tcr[]>(`${API}/get-tcrs`)]),
  );
  return (
    <ListView
      icon={IconBuildingStore}
      title={t("tabs.units")}
      description={t("units.lead")}
      loading={loading}
      error={error}
      reload={() => void reload()}
    >
      {data && (
        <Stack gap="lg">
          <Stack gap="xs">
            <Title order={4}>{t("units.bu")}</Title>
            {data[0].length ? (
              <DataTable<BusinessUnit>
                rows={data[0]}
                rowKey={(row, index) => row.BUCode ?? String(index)}
                columns={[
                  { label: t("bu.code"), render: (row) => <Copyable value={row.BUCode} /> },
                  {
                    label: t("bu.name"),
                    grow: true,
                    render: (row) => (
                      <Text size="sm" fw={600}>
                        {row.BUName}
                      </Text>
                    ),
                  },
                  { label: t("bu.address"), grow: true, render: (row) => row.BUStreetName },
                  {
                    label: t("bu.serial"),
                    value: (row) => row.BUSerialNumber,
                    render: (row) => row.BUSerialNumber,
                  },
                  { label: t("op.validFrom"), render: (row) => formatDate(row.BUValidFrom, false) },
                  {
                    label: t("op.validTo"),
                    value: (row) => row.BUValidTo,
                    render: (row) => formatDate(row.BUValidTo, false),
                  },
                  {
                    label: t("op.status"),
                    render: (row) => <StatusBadge active={isActive(row.BUValidFrom, row.BUValidTo)} />,
                  },
                ]}
              />
            ) : (
              <Empty>{t("units.empty")}</Empty>
            )}
          </Stack>
          <Stack gap="xs">
            <Title order={4}>{t("units.tcr")}</Title>
            {data[1].length ? (
              <DataTable<Tcr>
                rows={data[1]}
                rowKey={(row, index) => row.TCRCode ?? String(index)}
                minWidth={980}
                columns={[
                  { label: t("tcr.code"), render: (row) => <Copyable value={row.TCRCode} /> },
                  { label: t("tcr.internal"), render: (row) => row.TCRIntID },
                  { label: t("tcr.unit"), render: (row) => <Code value={row.BusinUnitCode} /> },
                  { label: t("tcr.type"), value: (row) => row.Type, render: (row) => row.Type },
                  {
                    label: t("tcr.software"),
                    value: (row) => row.SoftCode,
                    render: (row) => <Code value={row.SoftCode} />,
                  },
                  {
                    label: t("tcr.maintainer"),
                    value: (row) => row.MaintainerCode,
                    render: (row) => <Code value={row.MaintainerCode} />,
                  },
                  { label: t("op.validFrom"), render: (row) => formatDate(row.ValidFrom, false) },
                  {
                    label: t("op.validTo"),
                    value: (row) => row.ValidTo,
                    render: (row) => formatDate(row.ValidTo, false),
                  },
                  {
                    label: t("op.status"),
                    render: (row) => <StatusBadge active={isActive(row.ValidFrom, row.ValidTo)} />,
                  },
                ]}
              />
            ) : (
              <Empty>{t("units.empty")}</Empty>
            )}
          </Stack>
        </Stack>
      )}
    </ListView>
  );
}
