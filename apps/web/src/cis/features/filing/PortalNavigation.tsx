import { NavLink, Paper, Select, Stack, Text, TextInput } from "@mantine/core";
import { useState } from "react";
import { useI18n } from "../../i18n";
import type { PortalSnapshot } from "./types";

/** Links come from the verified portal snapshot. The API accepts only their keys. */
export function PortalNavigation({
  snapshot,
  busy,
  onNavigate,
}: {
  snapshot: PortalSnapshot;
  busy: boolean;
  onNavigate: (key: string) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const links = (snapshot.navigation ?? []).filter((link) =>
    link.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <Paper p="sm" component="nav" aria-label={t("filing.navigation")}>
      <Stack gap="sm">
        <Text size="sm" fw={600} visibleFrom="md">
          {t("filing.navigation")}
        </Text>
        <Select
          label={t("filing.navigation")}
          hiddenFrom="md"
          placeholder={t("filing.choosePage")}
          searchable
          value={null}
          disabled={busy}
          data={links.map((link) => ({ value: link.key, label: link.label }))}
          onChange={(key) => key && onNavigate(key)}
        />
        <TextInput
          visibleFrom="md"
          aria-label={t("filing.findPage")}
          placeholder={t("filing.findPage")}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <Stack gap={2} visibleFrom="md">
          {links.map((link) => (
            <NavLink
              component="button"
              type="button"
              key={link.key}
              label={link.label}
              active={link.url === snapshot.url}
              disabled={busy}
              onClick={() => onNavigate(link.key)}
            />
          ))}
        </Stack>
        {!snapshot.navigation?.length && (
          <Text size="sm" c="dimmed">
            {t("filing.noNavigation")}
          </Text>
        )}
        <Text size="xs" c="dimmed" visibleFrom="md">
          {t("filing.navigationHelp")}
        </Text>
      </Stack>
    </Paper>
  );
}
