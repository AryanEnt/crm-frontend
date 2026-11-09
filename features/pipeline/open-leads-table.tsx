"use client";

import * as React from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { NextStepChip } from "@/components/ui/next-step-chip";
import { stageSlotFromPipeline } from "@/components/ui/stage-rail";
import { formatLeadMoney } from "@/features/leads/lead-format";
import type { Lead, Pipeline } from "@/lib/api/crm";
import { stageBadgeClass } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import type { ClosedSortKey, SortOrder } from "./pipeline-filters";
import { OwnerAvatar } from "./pipeline-ui";

const muted = <span className="text-ink-muted">—</span>;

function stageMeta(lead: Lead, pipelines: Pipeline[]) {
  const pipeline = pipelines.find((p) => p.id === lead.pipelineId);
  const stage = pipeline?.stages.find((s) => s.id === lead.stageId);
  if (!pipeline || !stage) return null;
  const open = pipeline.stages.filter((s) => !s.isWon && !s.isLost);
  const position = open.findIndex((s) => s.id === stage.id);
  return {
    name: stage.name,
    slot: stageSlotFromPipeline({
      position: position >= 0 ? position : 0,
      openStageCount: open.length || 1,
      isWon: stage.isWon,
      isLost: stage.isLost,
    }),
  };
}

/** Paged table of open (or all) pipeline leads — counterpart to the kanban board. */
export function OpenLeadsTable({
  rows,
  total,
  loading,
  error,
  onRetry,
  pipelines,
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
  rows: Lead[];
  total: number;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  pipelines: Pipeline[];
  sort: ClosedSortKey;
  order: SortOrder;
  onSortChange: (sort: ClosedSortKey, order: SortOrder) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onOpenLead: (leadId: string) => void;
  empty: React.ReactNode;
}) {
  const columns = React.useMemo<ColumnDef<Lead>[]>(
    () => [
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
        id: "stage",
        header: "Stage",
        cell: ({ row }) => {
          const meta = stageMeta(row.original, pipelines);
          if (!meta) {
            return row.original.stageName ? (
              <span className="text-ink-secondary">{row.original.stageName}</span>
            ) : (
              muted
            );
          }
          return (
            <span
              className={cn(
                "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-caption font-medium",
                stageBadgeClass[meta.slot],
              )}
            >
              {meta.name}
            </span>
          );
        },
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
        id: "next",
        accessorKey: "nextActivityAt",
        header: ({ column }) => <SortableHeader column={column} title="Next action" />,
        meta: { label: "Next action" },
        cell: ({ row }) =>
          row.original.status === "won" || row.original.status === "lost" ? (
            <span className="capitalize text-ink-secondary">{row.original.status}</span>
          ) : (
            <NextStepChip at={row.original.nextActivityAt} />
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
        id: "source",
        header: "Source",
        cell: ({ row }) =>
          row.original.source ? <span className="text-ink-secondary">{row.original.source}</span> : muted,
      },
    ],
    [pipelines],
  );

  const effectiveSort: ClosedSortKey = sort === "closed" ? "next" : sort;
  const sorting = React.useMemo<SortingState>(
    () => [{ id: effectiveSort, desc: sort === "closed" ? false : order === "desc" }],
    [effectiveSort, order, sort],
  );

  if (error) return <ErrorState title="Couldn't load leads" onRetry={onRetry} />;
  if (!loading && total === 0) return <>{empty}</>;

  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={loading}
      itemLabel="leads"
      onRowClick={(lead) => onOpenLead(lead.id)}
      sorting={sorting}
      onSortingChange={(next) => {
        const s = next[0];
        if (!s) return onSortChange("next", "asc");
        if (s.id === "name" || s.id === "value" || s.id === "next") {
          onSortChange(s.id, s.desc ? "desc" : "asc");
        }
      }}
      pagination={{ page, pageSize, total, onPageChange, onPageSizeChange }}
    />
  );
}
