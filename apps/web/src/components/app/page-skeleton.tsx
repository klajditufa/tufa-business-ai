import { Group, Paper, SimpleGrid, Skeleton, Stack } from "@mantine/core";

/**
 * Pamja gjatë ngarkimit të një faqeje: titulli, filtri, kartat e totaleve dhe tabela në gri që pulson.
 * Shfaqet menjëherë pas klikimit, derisa serveri të sjellë të dhënat.
 */
export function PageSkeleton({ stats = true, rows = 6 }: { stats?: boolean; rows?: number }) {
  return (
    <Stack gap="lg" aria-busy="true" aria-label="Duke ngarkuar">
      <Group gap="md" wrap="nowrap">
        <Skeleton h={44} w={44} radius="md" />
        <Stack gap={8} style={{ flex: 1 }}>
          <Skeleton h={22} w={220} radius="sm" />
          <Skeleton h={12} w={340} maw="80%" radius="sm" />
        </Stack>
      </Group>
      <Paper p="md">
        <Group gap="sm" align="flex-end">
          <Skeleton h={36} w={170} />
          <Skeleton h={36} w={160} />
          <Skeleton h={36} w={160} />
          <Skeleton h={36} w={130} />
        </Group>
      </Paper>
      {stats && (
        <SimpleGrid cols={{ base: 2, lg: 4 }} spacing="sm">
          {[0, 1, 2, 3].map((i) => (
            <Paper key={i} px="md" py="sm">
              <Skeleton h={10} w={70} mb={10} />
              <Skeleton h={24} w="60%" />
            </Paper>
          ))}
        </SimpleGrid>
      )}
      <Paper p="md">
        <Stack gap="md">
          <Skeleton h={12} w="100%" />
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} h={18} w={`${92 - (i % 3) * 9}%`} />
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
