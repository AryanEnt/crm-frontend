"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox, Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/console/avatar";
import { Button } from "@/components/ui/console/button";
import { Checkbox } from "@/components/ui/console/checkbox";
import { EmptyState } from "@/components/ui/console/empty-state";
import { Skeleton } from "@/components/ui/console/skeleton";
import {
  Table,
  TableCard,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
} from "@/components/ui/console/data-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Plain-text column name for menus when `header` renders a component. */
    label?: string;
    /** Right-align counts, currency, and dates. */
    align?: "left" | "right";
  }
}

export type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  searchable?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  emptyIcon?: LucideIcon;
  pageSize?: number;
  className?: string;
  onRowSelectionChange?: (rows: TData[]) => void;
  /** Change this after a bulk action to drop the checked rows along with the action bar. */
  selectionResetKey?: unknown;
  /** Row click / Enter. Clicks on links, buttons and checkboxes inside the row are ignored. */
  onRowClick?: (row: TData) => void;
  /** Noun for the footer, e.g. "customers" -> "Showing 1–10 of 42 customers". */
  itemLabel?: string;
  /** Hidden columns from `useColumnVisibility`; omit to show every column. */
  columnVisibility?: VisibilityState;
  /** Server-side paging: `data` is one page and `total` counts every match. */
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
  };
  /** Server-side sorting; headers update this instead of sorting the loaded page. */
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
};

const SELECT_COLUMN_ID = "select";
const ALL_VISIBLE: VisibilityState = {};

export function DataTable<TData, TValue>({
  columns,
  data,
  loading,
  searchValue = "",
  emptyTitle = "Nothing to show",
  emptyDescription = "Adjust filters or create a new record.",
  emptyActionLabel,
  onEmptyAction,
  emptyIcon = Inbox,
  pageSize = 10,
  className,
  onRowSelectionChange,
  selectionResetKey,
  onRowClick,
  itemLabel,
  columnVisibility = ALL_VISIBLE,
  pagination: serverPagination,
  sorting: serverSorting,
  onSortingChange: onServerSortingChange,
}: DataTableProps<TData, TValue>) {
  const [localSorting, setLocalSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const manualSorting = serverSorting !== undefined && onServerSortingChange !== undefined;
  const sorting = manualSorting ? serverSorting : localSorting;

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      columnVisibility,
      globalFilter: searchValue,
      ...(serverPagination
        ? { pagination: { pageIndex: serverPagination.page - 1, pageSize: serverPagination.pageSize } }
        : {}),
    },
    enableRowSelection: true,
    manualSorting,
    manualPagination: !!serverPagination,
    pageCount: serverPagination
      ? Math.max(1, Math.ceil(serverPagination.total / serverPagination.pageSize))
      : undefined,
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      if (manualSorting) onServerSortingChange(next);
      else setLocalSorting(next);
    },
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize },
    },
  });

  React.useEffect(() => {
    if (!onRowSelectionChange) return;
    const selected = table.getFilteredSelectedRowModel().rows.map((r) => r.original);
    onRowSelectionChange(selected);
  }, [rowSelection, onRowSelectionChange, table]);

  const [syncedResetKey, setSyncedResetKey] = React.useState(selectionResetKey);
  if (syncedResetKey !== selectionResetKey) {
    setSyncedResetKey(selectionResetKey);
    setRowSelection({});
  }

  const headerGroups = table.getHeaderGroups();
  const visibleColumns = table.getVisibleLeafColumns();
  const rows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination;

  const head = (
    <thead>
      {headerGroups.map((headerGroup) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header) => (
            <TableHead
              key={header.id}
              align={header.column.columnDef.meta?.align}
              className={cn(header.column.id === SELECT_COLUMN_ID && "w-10 pr-0")}
            >
              {header.isPlaceholder
                ? null
                : flexRender(header.column.columnDef.header, header.getContext())}
            </TableHead>
          ))}
        </tr>
      ))}
    </thead>
  );

  let body: React.ReactNode;
  if (loading) {
    body = (
      <Table aria-busy="true">
        {head}
        <tbody>
          {Array.from({ length: 6 }, (_, i) => (
            <tr key={i} className="[&>td]:border-b [&>td]:border-line last:[&>td]:border-b-0">
              {visibleColumns.map((column, colIndex) => (
                <td
                  key={column.id}
                  className={cn(
                    "h-(--table-row-height) px-3 first:pl-4 last:pr-4",
                    column.id === SELECT_COLUMN_ID && "w-10 pr-0",
                  )}
                >
                  {column.id === SELECT_COLUMN_ID ? (
                    <Skeleton className="size-4 rounded-sm" />
                  ) : colIndex <= 1 ? (
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="size-6 rounded-full" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  ) : (
                    <Skeleton className="h-3 w-16" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    );
  } else if (rows.length === 0) {
    body = (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={
          emptyActionLabel && onEmptyAction ? (
            <Button variant="primary" onClick={onEmptyAction}>
              <Plus aria-hidden />
              {emptyActionLabel}
            </Button>
          ) : null
        }
      />
    );
  } else {
    body = (
      <Table>
        {head}
        <tbody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              selected={row.getIsSelected()}
              onActivate={onRowClick ? () => onRowClick(row.original) : undefined}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  align={cell.column.columnDef.meta?.align}
                  className={cn(cell.column.id === SELECT_COLUMN_ID && "w-10 pr-0")}
                  data-row-ignore={cell.column.id === SELECT_COLUMN_ID ? true : undefined}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </tbody>
      </Table>
    );
  }

  return (
    <TableCard
      className={className}
      scrollClassName="max-h-[calc(100dvh-17rem)]"
      footer={
        serverPagination ? (
          !loading && serverPagination.total > 0 ? (
            <TablePagination
              page={serverPagination.page}
              pageSize={serverPagination.pageSize}
              total={serverPagination.total}
              itemLabel={itemLabel}
              onPageChange={serverPagination.onPageChange}
              onPageSizeChange={serverPagination.onPageSizeChange}
            />
          ) : null
        ) : !loading && filteredCount > 0 ? (
          <TablePagination
            page={pageIndex + 1}
            pageSize={currentPageSize}
            total={filteredCount}
            itemLabel={itemLabel}
            onPageChange={(next) => table.setPageIndex(next - 1)}
            onPageSizeChange={(size) => {
              table.setPageSize(size);
              table.setPageIndex(0);
            }}
          />
        ) : null
      }
    >
      {body}
    </TableCard>
  );
}

export function createSelectColumn<TData>(): ColumnDef<TData> {
  return {
    id: SELECT_COLUMN_ID,
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all rows on this page"
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={!table.getIsAllPageRowsSelected() && table.getIsSomePageRowsSelected()}
        onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label="Select row"
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => row.toggleSelected(checked)}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 36,
  };
}

/** Avatar + name + secondary line, matching the Control Center users table. */
export function EntityCell({
  name,
  subtitle,
  avatarName,
  children,
}: {
  name: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Text used for initials and tint; defaults to `name` when it is a string. */
  avatarName?: string;
  children?: React.ReactNode;
}) {
  const initialsSource = avatarName ?? (typeof name === "string" ? name : "");
  return (
    <div className="flex min-w-0 items-center gap-2.5 comfortable:gap-3">
      <Avatar
        name={initialsSource || "?"}
        size="sm"
        className="comfortable:size-8 comfortable:text-caption"
      />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate font-medium text-ink">{name}</p>
          {children}
        </div>
        {subtitle ? <p className="truncate text-caption text-ink-muted">{subtitle}</p> : null}
      </div>
    </div>
  );
}

export function SortableHeader({
  column,
  title,
}: {
  column: {
    getIsSorted: () => false | "asc" | "desc";
    toggleSorting: (desc?: boolean) => void;
  };
  title: string;
}) {
  const sorted = column.getIsSorted();
  const Arrow = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      className={cn(
        "group/sort -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors duration-150 hover:text-ink",
        sorted && "text-ink",
      )}
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {title}
      <Arrow
        aria-hidden
        className={cn(
          "size-3 transition-opacity duration-150",
          sorted ? "opacity-100" : "opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60",
        )}
      />
    </button>
  );
}
