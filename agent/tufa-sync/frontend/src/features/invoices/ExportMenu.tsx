import { Button, Menu, Stack, Text } from "@mantine/core";
import {
  IconBox,
  IconChevronDown,
  IconFileTypePdf,
  IconFileZip,
  IconFiles,
  IconList,
  type Icon,
} from "@tabler/icons-react";
import { useI18n } from "../../i18n";

export type PdfAction = "list" | "items" | "all" | "zip";

const OPTIONS: {
  action: PdfAction;
  icon: Icon;
  title: "pdf.list" | "pdf.byItem" | "pdf.all" | "pdf.zip";
  note: "pdf.listNote" | "pdf.byItemNote" | "pdf.allNote" | "pdf.zipNote";
}[] = [
  { action: "list", icon: IconList, title: "pdf.list", note: "pdf.listNote" },
  { action: "items", icon: IconBox, title: "pdf.byItem", note: "pdf.byItemNote" },
  { action: "all", icon: IconFiles, title: "pdf.all", note: "pdf.allNote" },
  { action: "zip", icon: IconFileZip, title: "pdf.zip", note: "pdf.zipNote" },
];

/** The PDF exports of the invoices on screen. */
export function ExportMenu({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (action: PdfAction) => void;
}) {
  const { t } = useI18n();
  return (
    <Menu width={340}>
      <Menu.Target>
        <Button
          size="sm"
          variant="default"
          disabled={disabled}
          leftSection={<IconFileTypePdf size={16} stroke={1.8} />}
          rightSection={<IconChevronDown size={14} />}
        >
          {t("pdf.menu")}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {OPTIONS.map(({ action, icon: OptionIcon, title, note }) => (
          <Menu.Item
            key={action}
            leftSection={<OptionIcon size={18} stroke={1.7} />}
            onClick={() => onSelect(action)}
          >
            <Stack gap={0}>
              <Text size="sm" fw={600}>
                {t(title)}
              </Text>
              <Text size="xs" c="dimmed">
                {t(note)}
              </Text>
            </Stack>
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Label>{t("pdf.scope")}</Menu.Label>
      </Menu.Dropdown>
    </Menu>
  );
}
