import { Group, Pagination, Select, Table, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconChevronUp, IconSelector } from "@tabler/icons-react";
import { useState, type ReactNode } from "react";
import { useI18n } from "../i18n";
import { PAGE_SIZES, usePreference } from "../lib/preferences";
import type { Sort } from "../types";

export type { Sort };

const SMALLEST_PAGE = Math.min(...PAGE_SIZES);

export interface Column<T> {
  label: ReactNode;
  render: (row: T) => ReactNode;
  align?: "right";
  sortKey?: string;
  /** Lets the column wrap and take the spare width (names, descriptions). */
  grow?: boolean;
  /** For optional fields: the column is left out when no row has a value. */
  value?: (row: T) => unknown;
}

/**
 * A table with optional sorting, row clicks and pages; the page size is a saved preference.
 * Give it a new `key` when the rows are filtered so it goes back to the first page.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  sort,
  onSort,
  onRowClick,
  minWidth = 720,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  sort?: Sort;
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  minWidth?: number;
}) {
  const { t } = useI18n();
  const [pageSize, setPageSize] = usePreference("pageSize");
  const shown = columns.filter((column) => !column.value || rows.some((row) => column.value?.(row)));
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const start = (current - 1) * pageSize;

  return (
    <div>
      <Table.ScrollContainer minWidth={minWidth} type="native">
        <Table
          className={onRowClick ? "clickable-rows" : undefined}
          withTableBorder
          bg="var(--mantine-color-body)"
          style={{ borderRadius: "var(--mantine-radius-lg)", overflow: "hidden" }}
        >
          <Table.Thead bg="var(--mantine-color-default-hover)">
            <Table.Tr>
              {shown.map((column, index) => {
                const sortable = Boolean(onSort && column.sortKey);
                const active = sortable && sort?.key === column.sortKey;
                const SortIcon = !active ? IconSelector : sort?.dir === 1 ? IconChevronUp : IconChevronDown;
                const label = (
                  <Text span size="xs" fw={600} c={active ? undefined : "dimmed"}>
                    {column.label}
                  </Text>
                );
                return (
                  <Table.Th
                    key={index}
                    ta={column.align}
                    aria-sort={active ? (sort?.dir === 1 ? "ascending" : "descending") : undefined}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {sortable ? (
                      <UnstyledButton onClick={() => onSort?.(column.sortKey as string)}>
                        <Group
                          gap={4}
                          wrap="nowrap"
                          justify={column.align === "right" ? "flex-end" : "flex-start"}
                        >
                          {label}
                          <SortIcon size={13} stroke={1.8} opacity={active ? 1 : 0.45} />
                        </Group>
                      </UnstyledButton>
                    ) : (
                      label
                    )}
                  </Table.Th>
                );
              })}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.slice(start, start + pageSize).map((row, index) => (
              <Table.Tr
                key={rowKey(row, start + index)}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter") onRowClick(row);
                      }
                    : undefined
                }
              >
                {shown.map((column, cell) => (
                  <Table.Td
                    key={cell}
                    ta={column.align}
                    style={
                      column.grow
                        ? undefined
                        : { whiteSpace: column.align === "right" ? "nowrap" : undefined }
                    }
                  >
                    {column.render(row)}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {rows.length > SMALLEST_PAGE && (
        <Group justify="space-between" mt="sm" gap="sm">
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              {t("pager.perPage")}
            </Text>
            <Select
              size="xs"
              w={84}
              data={PAGE_SIZES.map(String)}
              value={String(pageSize)}
              onChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
              aria-label={t("pager.perPage")}
            />
          </Group>
          <Group gap="md">
            <Text size="sm" c="dimmed">
              {t("pager.range", {
                from: start + 1,
                to: Math.min(start + pageSize, rows.length),
                total: rows.length,
              })}
            </Text>
            <Pagination size="sm" total={pages} value={current} onChange={setPage} />
          </Group>
        </Group>
      )}
    </div>
  );
}
