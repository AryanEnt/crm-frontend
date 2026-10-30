"use client";

import * as React from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { formatLeadMoney } from "@/features/leads/lead-format";
import type { Lead } from "@/lib/api/crm";
import type { ClosedSortKey, SortOrder } from "./pipeline-filters";
import { formatDate } from "./pipeline-format";
import { OwnerAvatar } from "./pipeline-ui";

const muted = <span className="text-ink-muted">—</span>;

export function ClosedLeadsTable({
  kind,
  rows,
  total,
  loading,
  error,
  onRetry,
  sort,
  order,
  onSortChange,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onOpenLead,
  empty,
}: {
  kind: "won" | "lost" | "complete";
  rows: Lead[];
  total: number;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  sort: ClosedSortKey;
  order: SortOrder;
  onSortChange: (sort: ClosedSortKey, order: SortOrder) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onOpenLead: (leadId: string) => void;
  /** Shown instead of the table when nothing matches. */
  empty: React.ReactNode;
}) {
  const columns = React.useMemo<ColumnDef<Lead>[]>(() => {
    const cols: ColumnDef<Lead>[] = [
      {
        id: "name",
        accessorKey: "fullName",
        header: ({ column }) => <SortableHeader column={column} title="Lead" />,
        meta: { label: "Lead" },
        cell: ({ row }) => (
          <span className="block max-w-[220px]">
            <span className="block truncate font-medium text-ink">{row.original.fullName}</span>
            {row.original.email ? (
              <span className="block truncate text-caption text-ink-muted">{row.original.email}</span>
            ) : null}
          </span>
        ),
      },
      {
        id: "company",
        header: "Company",
        cell: ({ row }) =>
          row.original.employer ? (
            <span className="block max-w-[180px] truncate text-ink-secondary">{row.original.employer}</span>
          ) : (
            muted
          ),
      },
      {
        id: "value",
        accessorKey: "potentialValue",
        header: ({ column }) => <SortableHeader column={column} title="Est. value" />,
        meta: { label: "Estimated value", align: "right" },
        cell: ({ row }) =>
          row.original.potentialValue != null ? (
            <span className="font-medium tabular-nums text-ink" title="Estimated value">
              {formatLeadMoney(row.original.potentialValue, row.original.currency)}
            </span>
          ) : (
            muted
          ),
      },
      {
        id: "owner",
        header: "Owner",
        cell: ({ row }) =>
          row.original.ownerName ? (
            <span className="flex min-w-0 items-center gap-2 text-ink-secondary">
              <OwnerAvatar id={row.original.ownerUserId} name={row.original.ownerName} />
              <span className="truncate">{row.original.ownerName}</span>
            </span>
          ) : (
            <span className="text-ink-muted">Unassigned</span>
          ),
      },
      {
        id: "closed",
        header: ({ column }) => <SortableHeader column={column} title="Closed" />,
        meta: { label: "Closed" },
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-ink-secondary">
            {formatDate(kind === "lost" ? row.original.lostAt : row.original.wonAt)}
          </span>
        ),
      },
      {
        id: "source",
        header: "Source",
        cell: ({ row }) => (row.original.source ? <span className="text-ink-secondary">{row.original.source}</span> : muted),
      },
    ];
    if (kind === "lost") {
      cols.push({
        id: "lostReason",
        header: "Lost reason",
        cell: ({ row }) =>
          row.original.lostReason ? (
            <span className="block max-w-[260px] truncate text-ink-secondary" title={row.original.lostReason}>
              {row.original.lostReason}
            </span>
          ) : (
            muted
          ),
      });
    }
    return cols;
  }, [kind]);

  const sorting = React.useMemo<SortingState>(() => [{ id: sort, desc: order === "desc" }], [sort, order]);

  if (error) return <ErrorState title={`Couldn't load ${kind} leads`} onRetry={onRetry} />;
  if (!loading && total === 0) return <>{empty}</>;

  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={loading}
      itemLabel={`${kind} leads`}
      onRowClick={(lead) => onOpenLead(lead.id)}
      sorting={sorting}
      onSortingChange={(next) => {
        const s = next[0];
        if (!s) return onSortChange("closed", "desc");
        if (s.id === "name" || s.id === "value" || s.id === "closed") onSortChange(s.id, s.desc ? "desc" : "asc");
      }}
      pagination={{ page, pageSize, total, onPageChange, onPageSizeChange }}
    />
  );
}
