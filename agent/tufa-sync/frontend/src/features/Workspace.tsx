import { Alert, Badge, Stack, Tabs } from "@mantine/core";
import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconBuildingStore,
  IconLayoutGrid,
  IconSearch,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "../i18n";
import { usePreference } from "../lib/preferences";
import type { Business } from "../types";
import { InvoicesView } from "./invoices/InvoicesView";
import { OverviewView } from "./overview/OverviewView";
import { OperatorsView, TaxpayersView, UnitsView } from "./registry/RegistryViews";
import { BusinessContext, useSession } from "./session/context";

type BusinessTab = "sales" | "purchases" | "taxpayers" | "operators" | "units";
type Tab = BusinessTab | "overview";

const BUSINESS_TABS: { name: BusinessTab; icon: Icon; panel: () => ReactNode }[] = [
  { name: "sales", icon: IconArrowUpRight, panel: () => <InvoicesView kind="SALES" /> },
  { name: "purchases", icon: IconArrowDownLeft, panel: () => <InvoicesView kind="PURCHASES" /> },
  { name: "taxpayers", icon: IconSearch, panel: () => <TaxpayersView /> },
  { name: "operators", icon: IconUsers, panel: () => <OperatorsView /> },
  { name: "units", icon: IconBuildingStore, panel: () => <UnitsView /> },
];
const TABS: Tab[] = [...BUSINESS_TABS.map((tab) => tab.name), "overview"];

/**
 * Tabs for the active business, plus the overview of all of them. Views stay mounted once
 * opened, per business, so switching tab or business and back keeps what was fetched.
 */
export function Workspace() {
  const { t } = useI18n();
  const { session, setSession } = useSession();
  const [saved, setSaved] = usePreference("tab");
  const tab: Tab = TABS.includes(saved as Tab) ? (saved as Tab) : "sales";
  const active: Business | undefined =
    session.businesses.find((business) => business.id === session.active) ?? session.businesses.at(0);
  const [opened, setOpened] = useState<Record<string, BusinessTab[]>>({});
  const businessTab = tab === "overview" ? null : tab;

  useEffect(() => {
    if (!active || !businessTab) return;
    setOpened((previous) => {
      const tabs = previous[active.id] ?? [];
      return tabs.includes(businessTab) ? previous : { ...previous, [active.id]: [...tabs, businessTab] };
    });
  }, [active, businessTab]);

  const openBusiness = (business: Business) => {
    setSession({ ...session, active: business.id });
    setSaved("sales");
  };

  return (
    <Stack gap="lg">
      {active?.warning && (
        <Alert color="yellow" variant="light">
          {active.warning}
        </Alert>
      )}
      <Tabs className="app-tabs" value={tab} onChange={(value) => value && setSaved(value)}>
        <Tabs.List>
          {BUSINESS_TABS.map(({ name, icon: TabIcon }) => (
            <Tabs.Tab key={name} value={name} leftSection={<TabIcon size={16} stroke={1.8} />}>
              {t(`tabs.${name}`)}
            </Tabs.Tab>
          ))}
          <Tabs.Tab
            value="overview"
            ml={{ base: 0, sm: "auto" }}
            leftSection={<IconLayoutGrid size={16} stroke={1.8} />}
            rightSection={
              session.businesses.length > 1 ? (
                <Badge size="sm" variant="light" color="gray" circle>
                  {session.businesses.length}
                </Badge>
              ) : undefined
            }
          >
            {t("tabs.overview")}
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>
      {session.businesses
        .filter((business) => opened[business.id])
        .map((business) => (
          <BusinessContext.Provider key={business.id} value={business}>
            {(opened[business.id] ?? []).map((name) => (
              <div key={name} role="tabpanel" hidden={business.id !== active?.id || name !== businessTab}>
                {BUSINESS_TABS.find((entry) => entry.name === name)?.panel()}
              </div>
            ))}
          </BusinessContext.Provider>
        ))}
      {tab === "overview" && (
        <div role="tabpanel">
          <OverviewView onOpen={openBusiness} />
        </div>
      )}
    </Stack>
  );
}
