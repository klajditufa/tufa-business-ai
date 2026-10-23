import { Paper, Skeleton, Stack } from "@mantine/core";

/** Brenda "Raporte & mjete" menuja mbetet; vetëm mjeti djathtas tregon ngarkimin. */
export default function Loading() {
  return (
    <Stack gap="md" aria-busy="true" aria-label="Duke ngarkuar">
      <Skeleton h={22} w={260} />
      <Skeleton h={12} w={380} maw="90%" />
      <Paper p="md">
        <Stack gap="md">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} h={18} w={`${95 - (i % 3) * 10}%`} />
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
