import {
  ActionIcon,
  AppShell,
  Center,
  Container,
  Group,
  Loader,
  Menu,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  Title,
  Tooltip,
  useMantineColorScheme,
} from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { IconAdjustmentsHorizontal, IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { api, setUnauthorizedHandler } from "./api";
import { ErrorBox } from "./components/ui";
import { BusinessSwitcher } from "./features/session/BusinessSwitcher";
import { SessionContext } from "./features/session/context";
import { SetupForm } from "./features/session/SetupForm";
import { Workspace } from "./features/Workspace";
import { useI18n } from "./i18n";
import type { Session } from "./types";

const loadSession = () => api<Session>("/api/session", undefined, { method: "GET" });

function ThemeSwitch({ fullWidth = false }: { fullWidth?: boolean }) {
  const { t } = useI18n();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const options = [
    { value: "auto", label: t("theme.auto"), icon: IconDeviceDesktop },
    { value: "light", label: t("theme.light"), icon: IconSun },
    { value: "dark", label: t("theme.dark"), icon: IconMoon },
  ] as const;
  return (
    <SegmentedControl
      size="xs"
      fullWidth={fullWidth}
      aria-label={t("theme.label")}
      value={colorScheme}
      onChange={(value) => setColorScheme(value)}
      data={options.map(({ value, label, icon: Icon }) => ({
        value,
        label: (
          <Tooltip label={label}>
            <Center h={20} w={20} mx="auto" aria-label={label}>
              <Icon size={15} stroke={1.8} />
            </Center>
          </Tooltip>
        ),
      }))}
    />
  );
}

/** On phones theme and language share one menu, so the top bar fits. */
function SettingsMenu() {
  const { t } = useI18n();
  return (
    <Menu width={220} closeOnItemClick={false}>
      <Menu.Target>
        <ActionIcon size="lg" variant="default" aria-label={t("theme.label")}>
          <IconAdjustmentsHorizontal size={18} stroke={1.8} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown p="sm">
        <Stack gap="sm">
          <ThemeSwitch fullWidth />
          <LanguageSwitch fullWidth />
        </Stack>
      </Menu.Dropdown>
    </Menu>
  );
}

function LanguageSwitch({ fullWidth = false }: { fullWidth?: boolean }) {
  const { lang, setLang } = useI18n();
  return (
    <SegmentedControl
      size="xs"
      fullWidth={fullWidth}
      aria-label="Language / Gjuha"
      value={lang}
      onChange={(value) => setLang(value)}
      data={[
        { value: "sq", label: "SQ" },
        { value: "en", label: "EN" },
      ]}
    />
  );
}

function Setup({ onLoaded }: { onLoaded: (session: Session) => void }) {
  const { t } = useI18n();
  return (
    <Center pt="6vh">
      <Paper p="xl" w="100%" maw={560} shadow="sm">
        <Stack gap="lg">
          <div>
            <Title order={2}>{t("setup.title")}</Title>
            <Text c="dimmed" mt={6}>
              {t("setup.lead")}
            </Text>
          </div>
          <SetupForm onLoaded={onLoaded} />
          <Text
            size="xs"
            c="dimmed"
            pt="md"
            style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
          >
            {t("setup.privacy")}
          </Text>
        </Stack>
      </Paper>
    </Center>
  );
}

export function App() {
  const { t, lang } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [bootError, setBootError] = useState<unknown>(null);

  useEffect(() => {
    loadSession().then(setSession, setBootError);
    // The server forgot a certificate (it was restarted): show what it still has.
    setUnauthorizedHandler(() => {
      loadSession().then(setSession, () => {});
    });
  }, []);

  const context = useMemo(() => (session ? { session, setSession } : null), [session]);
  const loaded = Boolean(session?.businesses.length);

  return (
    <DatesProvider settings={{ locale: lang, firstDayOfWeek: 1, weekendDays: [0, 6] }}>
      <SessionContext.Provider value={context}>
        <AppShell header={{ height: 60 }} padding={{ base: "xs", sm: "lg" }}>
          <AppShell.Header>
            <Container size={1440} h="100%" px={{ base: "sm", sm: "md" }}>
              <Group h="100%" justify="space-between" wrap="nowrap" gap="sm">
                <Group gap={10} wrap="nowrap" style={{ flex: "none" }}>
                  <img src="/favicon.svg" alt="" width={30} height={30} />
                  <Text fw={700} size="md" visibleFrom="md">
                    CIS Client
                  </Text>
                </Group>
                <Group gap="sm" wrap="nowrap" justify="flex-end" style={{ flex: 1, minWidth: 0 }}>
                  {loaded && <BusinessSwitcher />}
                  <Group gap="sm" wrap="nowrap" visibleFrom="sm">
                    <ThemeSwitch />
                    <LanguageSwitch />
                  </Group>
                  <Group hiddenFrom="sm">
                    <SettingsMenu />
                  </Group>
                </Group>
              </Group>
            </Container>
          </AppShell.Header>
          <AppShell.Main>
            <Container size={1440} px={{ base: "xs", sm: "md" }} pb="xl">
              {bootError !== null ? (
                <ErrorBox error={bootError} />
              ) : !session ? (
                <Center py="xl">
                  <Loader />
                </Center>
              ) : loaded ? (
                <Workspace />
              ) : (
                <Setup onLoaded={setSession} />
              )}
              <Text size="xs" c="dimmed" mt={48}>
                {t("footer")}
              </Text>
            </Container>
          </AppShell.Main>
        </AppShell>
      </SessionContext.Provider>
    </DatesProvider>
  );
}
