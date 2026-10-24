import { Group, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import type { Icon } from "@tabler/icons-react";
import type { ReactNode } from "react";

/** Colour of a page's icon: what the page is about. */
const TONES = { sales: "teal", purchases: "blue", overview: "violet", registry: "gray" } as const;

/** The heading every tab starts with: what the page shows, and its own actions on the right. */
export function PageHead({
  icon: IconComponent,
  tone,
  title,
  description,
  actions,
}: {
  icon: Icon;
  tone: keyof typeof TONES;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <Group justify="space-between" align="center" gap="md">
      <Group gap="md" wrap="nowrap" align="center">
        <ThemeIcon size={44} radius="md" variant="light" color={TONES[tone]} visibleFrom="xs">
          <IconComponent size={24} stroke={1.7} />
        </ThemeIcon>
        <Stack gap={2}>
          <Title order={2} fz={{ base: 20, sm: 24 }}>
            {title}
          </Title>
          {description && (
            <Text c="dimmed" size="sm">
              {description}
            </Text>
          )}
        </Stack>
      </Group>
      {actions && <Group gap="xs">{actions}</Group>}
    </Group>
  );
}
