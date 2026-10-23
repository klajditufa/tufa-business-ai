// Design system-i, i marrë nga cis-client-2 (frontend/src/theme.ts): komponentët e Mantine me këtë temë.
// Ngjyrat, rrezet, tipografia dhe vlerat e paracaktuara të çdo komponenti jetojnë këtu; ekranet vetëm i rendisin.
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  createTheme,
  localStorageColorSchemeManager,
  Menu,
  Modal,
  NativeSelect,
  Paper,
  SegmentedControl,
  Select,
  Table,
  Tabs,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { DateInput, DatePickerInput } from "@mantine/dates";

export const theme = createTheme({
  primaryColor: "indigo",
  primaryShade: { light: 6, dark: 5 },
  defaultRadius: "md",
  cursorType: "pointer",
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMonospace: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  headings: { fontWeight: "650" },
  components: {
    ActionIcon: ActionIcon.extend({ defaultProps: { variant: "subtle", color: "gray" } }),
    Alert: Alert.extend({ defaultProps: { radius: "md" } }),
    Badge: Badge.extend({ defaultProps: { variant: "light", radius: "sm", tt: "none" } }),
    Button: Button.extend({ defaultProps: { radius: "md" } }),
    Card: Card.extend({ defaultProps: { withBorder: true, radius: "lg" } }),
    DateInput: DateInput.extend({ defaultProps: { valueFormat: "DD.MM.YYYY", radius: "md" } }),
    DatePickerInput: DatePickerInput.extend({ defaultProps: { valueFormat: "DD.MM.YYYY", radius: "md" } }),
    Menu: Menu.extend({ defaultProps: { shadow: "lg", radius: "md", position: "bottom-end", withinPortal: true } }),
    Modal: Modal.extend({ defaultProps: { radius: "lg", overlayProps: { backgroundOpacity: 0.45, blur: 2 } } }),
    NativeSelect: NativeSelect.extend({ defaultProps: { radius: "md" } }),
    Paper: Paper.extend({ defaultProps: { withBorder: true, radius: "lg" } }),
    SegmentedControl: SegmentedControl.extend({ defaultProps: { radius: "md" } }),
    Select: Select.extend({
      defaultProps: { allowDeselect: false, checkIconPosition: "right", comboboxProps: { shadow: "lg" } },
    }),
    Table: Table.extend({ defaultProps: { highlightOnHover: true, verticalSpacing: "sm", horizontalSpacing: "md" } }),
    Tabs: Tabs.extend({ defaultProps: { keepMounted: true } }),
    TextInput: TextInput.extend({ defaultProps: { radius: "md" } }),
    Tooltip: Tooltip.extend({ defaultProps: { withArrow: true, openDelay: 300 } }),
  },
});

/** Zgjedhja e temës (sistemi / e çelët / e errët) ruhet në një çelës të vetëm. */
export const COLOR_SCHEME_KEY = "tufa-color-scheme";
export const colorSchemeManager = localStorageColorSchemeManager({ key: COLOR_SCHEME_KEY });
