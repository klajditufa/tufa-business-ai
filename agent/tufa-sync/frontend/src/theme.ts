// The design system: Mantine's components with this theme. Colours, radii, type and the
// defaults of each component live here, so screens only arrange components.
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  createTheme,
  type MantineColorScheme,
  type MantineColorSchemeManager,
  Menu,
  Modal,
  Paper,
  SegmentedControl,
  Select,
  Table,
  Tabs,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { getPreference, setPreference, subscribePreferences } from "./lib/preferences";

export const theme = createTheme({
  primaryColor: "indigo",
  primaryShade: { light: 6, dark: 5 },
  defaultRadius: "md",
  cursorType: "pointer",
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMonospace:
    'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  headings: { fontWeight: "650" },
  components: {
    ActionIcon: ActionIcon.extend({ defaultProps: { variant: "subtle", color: "gray" } }),
    Alert: Alert.extend({ defaultProps: { radius: "md" } }),
    Badge: Badge.extend({ defaultProps: { variant: "light", radius: "sm", tt: "none" } }),
    Button: Button.extend({ defaultProps: { radius: "md" } }),
    Card: Card.extend({ defaultProps: { withBorder: true, radius: "lg" } }),
    DatePickerInput: DatePickerInput.extend({ defaultProps: { valueFormat: "DD.MM.YYYY", radius: "md" } }),
    Menu: Menu.extend({
      defaultProps: { shadow: "lg", radius: "md", position: "bottom-end", withinPortal: true },
    }),
    Modal: Modal.extend({
      defaultProps: { radius: "lg", overlayProps: { backgroundOpacity: 0.45, blur: 2 } },
    }),
    Paper: Paper.extend({ defaultProps: { withBorder: true, radius: "lg" } }),
    SegmentedControl: SegmentedControl.extend({ defaultProps: { radius: "md" } }),
    Select: Select.extend({
      defaultProps: { allowDeselect: false, checkIconPosition: "right", comboboxProps: { shadow: "lg" } },
    }),
    Table: Table.extend({
      defaultProps: { highlightOnHover: true, verticalSpacing: "sm", horizontalSpacing: "md" },
    }),
    Tabs: Tabs.extend({ defaultProps: { keepMounted: true } }),
    TextInput: TextInput.extend({ defaultProps: { radius: "md" } }),
    Tooltip: Tooltip.extend({ defaultProps: { withArrow: true, openDelay: 300 } }),
  },
});

/**
 * Keeps Mantine's light / dark / auto choice in the saved UI preferences (lib/preferences.ts).
 * Mantine writes back whatever it is told, so only real theme changes are passed on to it.
 */
let unsubscribe = () => {};
export const colorSchemeManager: MantineColorSchemeManager = {
  get: () => getPreference("theme"),
  set: (value: MantineColorScheme) => {
    setPreference("theme", value);
  },
  subscribe: (onUpdate) => {
    let last = getPreference("theme");
    unsubscribe = subscribePreferences(() => {
      const theme = getPreference("theme");
      if (theme === last) return;
      last = theme;
      onUpdate(theme);
    });
  },
  unsubscribe: () => {
    unsubscribe();
  },
  clear: () => {
    setPreference("theme", "auto");
  },
};
