"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { Archive } from "lucide-react";
import { toast } from "sonner";
import {
  DataTable,
  EntityCell,
  SortableHeader,
  createSelectColumn,
} from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState } from "@/components/ui/error-state";
import { stageSlotFromPipeline } from "@/components/ui/stage-rail";
import { useAuth } from "@/features/auth/auth-provider";
import { useOwnerOptions } from "@/features/teams/scope-filters";
import { PhoneValidationBadge } from "@/features/leads/phone-validation-badge";
import { crmApi, type Lead, type Pipeline } from "@/lib/api/crm";
import { priorityFromString, stageBadgeClass } from "@/lib/design-tokens";
import { Avatar } from "@/components/ui/console/avatar";
import { NextStepChip } from "@/components/ui/next-step-chip";
import { InlineSelectCell } from "@/components/ui/inline-select-cell";
import { ColumnsMenu } from "@/components/ui/console/toolbar";
import { BulkActionBar } from "@/components/ui/console/data-table";
import { Button as ConsoleButton } from "@/components/ui/console/button";
import { useColumnVisibility } from "@/lib/column-visibility";
import { LEAD_PRIORITIES } from "@/validations/lead";
import { leadFilterParams, type LeadFilters } from "@/features/leads/lead-board-state";
import { countryFilterLabel, formatLeadCountry, formatLeadCount, formatLeadMoney } from "@/features/leads/lead-format";
import { cn } from "@/lib/utils";

const PRIORITY_OPTIONS = LEAD_PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }));

/** Optional date columns — off by default; turn on from the Columns menu. */
const LEADS_DEFAULT_HIDDEN_COLUMNS = ["lastActivityAt", "createdAt"];

/** Table column id -> API sort key. */
const SORT_KEYS: Record<string, string> = {
  fullName: "name",
  potentialValue: "value",
  priority: "priority",
  ageDays: "age",
  createdAt: "created",
  lastActivityAt: "lastActivity",
  nextActivityAt: "nextActivity",
};

export type LeadListStatus = "working" | "won" | "lost" | "all";

const STATUS_PARAM: Record<LeadListStatus, string> = {
  // "" keeps the API's default open set (legacy inbox/qualified included).
  working: "",
  won: "won",
  lost: "lost",
  all: "all",
};

function formatWhen(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString();
}

/** Single-line cell text so every column shares the same vertical rhythm. */
function CellText({
  children,
  empty = false,
  mono = false,
  className,
  title,
}: {
  children: React.ReactNode;
  empty?: boolean;
  mono?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "block truncate text-cell leading-5",
        empty ? "text-ink-muted" : "text-ink-secondary",
        mono && "font-mono text-caption tabular-nums",
        className,
      )}
    >
      {children}
    </span>
  );
}

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

/** Every lead the user can see, across lead pipelines; stage changes happen on /pipeline or in the lead panel. */
export function LeadsListView({
  pipelines,
  filters,
  onOpenLead,
  onCreateLead,
}: {
  pipelines: Pipeline[];
  filters: LeadFilters;
  onOpenLead: (leadId: string) => void;
  onCreateLead?: () => void;
}) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = React.useState<LeadListStatus>("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [selected, setSelected] = React.useState<Lead[]>([]);
  const [selectionResetKey, setSelectionResetKey] = React.useState(0);

  const canEditLeads = can("leads:edit");
  const canAssignLeads = can("leads:assign");
  const ownersQuery = useOwnerOptions(canAssignLeads);
  const ownerOptions = React.useMemo(
    () => (ownersQuery.data?.data ?? []).map((u) => ({ value: u.id, label: u.fullName })),
    [ownersQuery.data],
  );

  const params = React.useMemo(() => {
    const p = leadFilterParams("", filters);
    const statusParam = STATUS_PARAM[status];
    if (statusParam) p.set("status", statusParam);
    const sort = sorting[0];
    p.set("sort", (sort && SORT_KEYS[sort.id]) || "created");
    p.set("order", sort && !sort.desc ? "asc" : "desc");
    p.set("limit", String(pageSize));
    p.set("offset", String((page - 1) * pageSize));
    return p;
  }, [filters, status, sorting, page, pageSize]);

  // Any change other than the page itself starts again from page one.
  const resetKey = `${JSON.stringify(filters)}|${status}|${JSON.stringify(sorting)}|${pageSize}`;
  const [syncedKey, setSyncedKey] = React.useState(resetKey);
  if (syncedKey !== resetKey) {
    setSyncedKey(resetKey);
    setPage(1);
  }

  const leadsQuery = useQuery({
    queryKey: ["leads", params.toString()],
    queryFn: () => crmApi.listLeads(params),
    placeholderData: (prev) => prev,
  });

  const refreshLeads = React.useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["leads"] });
    void qc.invalidateQueries({ queryKey: ["lead-board"] });
  }, [qc]);

  const archiveMutation = useMutation({
    mutationFn: (ids: string[]) => crmApi.bulkArchiveLeads(ids, true),
    onSuccess: (_data, ids) => {
      void refreshLeads();
      setSelectionResetKey((k) => k + 1);
      toast.success(ids.length === 1 ? "Lead archived" : `${ids.length} leads archived`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Couldn't archive leads. Check permissions and try again.");
    },
  });

  const columns = React.useMemo<ColumnDef<Lead>[]>(
    () => [
      createSelectColumn<Lead>(),
      {
        accessorKey: "fullName",
        header: ({ column }) => <SortableHeader column={column} title="Lead" />,
        enableHiding: false,
        size: 220,
        cell: ({ row }) => (
          <EntityCell
            name={row.original.fullName}
            subtitle={row.original.jobTitle || undefined}
          />
        ),
      },
      {
        accessorKey: "employer",
        header: "Company",
        size: 150,
        cell: ({ row }) => {
          const value = row.original.employer?.trim();
          return (
            <CellText empty={!value} title={value || undefined}>
              {value || "—"}
            </CellText>
          );
        },
      },
      {
        id: "contact",
        header: "Contact",
        size: 170,
        cell: ({ row }) => {
          const { phone, email } = row.original;
          if (!phone && !email) return <CellText empty>—</CellText>;
          const primary = phone || email || "";
          const secondary = phone && email ? email : null;
          return (
            <div className="min-w-0">
              <span className="flex min-w-0 items-center gap-1">
                <CellText mono={Boolean(phone)} title={primary}>
                  {primary}
                </CellText>
                {phone ? <PhoneValidationBadge lead={row.original} /> : null}
              </span>
              {secondary ? (
                <span className="block truncate text-caption leading-4 text-ink-muted" title={secondary}>
                  {secondary}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "country",
        header: "Country",
        size: 110,
        cell: ({ row }) => {
          const label = formatLeadCountry(row.original.country);
          return (
            <CellText empty={label === "—"} title={label === "—" ? undefined : label}>
              {label}
            </CellText>
          );
        },
      },
      {
        id: "stage",
        header: "Stage",
        size: 120,
        cell: ({ row }) => {
          const meta = stageMeta(row.original, pipelines);
          if (!meta) {
            return <CellText empty={!row.original.stageName}>{row.original.stageName ?? "—"}</CellText>;
          }
          return (
            <span
              className={cn(
                "inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-caption font-medium",
                stageBadgeClass[meta.slot],
              )}
              title={meta.name}
            >
              {meta.name}
            </span>
          );
        },
      },
      {
        accessorKey: "potentialValue",
        header: ({ column }) => <SortableHeader column={column} title="Est. value" align="right" />,
        meta: { label: "Estimated value", align: "right" },
        size: 120,
        cell: ({ row }) =>
          row.original.potentialValue != null ? (
            <CellText className="text-ink tabular-nums" title="Estimated value">
              {formatLeadMoney(row.original.potentialValue, row.original.currency)}
            </CellText>
          ) : (
            <CellText empty>—</CellText>
          ),
      },
      {
        accessorKey: "nextActivityAt",
        header: ({ column }) => <SortableHeader column={column} title="Next action" />,
        meta: { label: "Next action" },
        size: 130,
        cell: ({ row }) =>
          row.original.status === "won" || row.original.status === "lost" ? (
            <CellText className="capitalize">{row.original.status}</CellText>
          ) : (
            <NextStepChip at={row.original.nextActivityAt} />
          ),
      },
      {
        accessorKey: "ownerName",
        header: "Owner",
        size: 150,
        cell: ({ row }) => (
          <InlineSelectCell
            label="owner"
            value={row.original.ownerUserId}
            options={ownerOptions}
            loading={ownersQuery.isLoading}
            disabled={!canAssignLeads}
            onSave={async (ownerUserId) => {
              await crmApi.bulkAssignLeads([row.original.id], ownerUserId);
              await refreshLeads();
            }}
          >
            {row.original.ownerName ? (
              <span className="flex min-w-0 items-center gap-2">
                <Avatar name={row.original.ownerName} size="sm" className="shrink-0" />
                <CellText title={row.original.ownerName}>{row.original.ownerName}</CellText>
              </span>
            ) : (
              <CellText empty>Unassigned</CellText>
            )}
          </InlineSelectCell>
        ),
      },
      {
        accessorKey: "source",
        header: "Source",
        size: 110,
        cell: ({ row }) => {
          const value = row.original.source?.trim();
          return (
            <CellText empty={!value} title={value || undefined}>
              {value || "—"}
            </CellText>
          );
        },
      },
      {
        accessorKey: "priority",
        header: ({ column }) => <SortableHeader column={column} title="Priority" />,
        meta: { label: "Priority" },
        size: 100,
        cell: ({ row }) => {
          const level = priorityFromString(row.original.priority);
          return (
            <InlineSelectCell
              label="priority"
              value={level}
              options={PRIORITY_OPTIONS}
              disabled={!canEditLeads}
              onSave={async (priority) => {
                await crmApi.updateLead(row.original.id, { priority, forceUpdate: true });
                await refreshLeads();
              }}
            >
              <span className="inline-flex items-center gap-1.5 capitalize text-cell text-ink-secondary">
                {level === "high" || level === "urgent" ? (
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      level === "urgent" ? "bg-priority-urgent" : "bg-priority-high",
                    )}
                  />
                ) : (
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-transparent" />
                )}
                {level}
              </span>
            </InlineSelectCell>
          );
        },
      },
      {
        accessorKey: "lastActivityAt",
        header: ({ column }) => <SortableHeader column={column} title="Last activity" />,
        meta: { label: "Last activity" },
        size: 120,
        cell: ({ row }) => {
          const value = formatWhen(row.original.lastActivityAt);
          return (
            <CellText empty={value === "—"} className="tabular-nums">
              {value}
            </CellText>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <SortableHeader column={column} title="Created" />,
        meta: { label: "Created" },
        size: 110,
        cell: ({ row }) => {
          const value = formatWhen(row.original.createdAt);
          return (
            <CellText empty={value === "—"} className="tabular-nums">
              {value}
            </CellText>
          );
        },
      },
    ],
    [canAssignLeads, canEditLeads, ownerOptions, ownersQuery.isLoading, pipelines, refreshLeads],
  );
  const columnPrefs = useColumnVisibility("leads", columns, {
    defaultHidden: LEADS_DEFAULT_HIDDEN_COLUMNS,
  });

  if (leadsQuery.isError) {
    return <ErrorState onRetry={() => void leadsQuery.refetch()} />;
  }

  const hasFilters = Object.values(filters).some((v) => v.trim() !== "") || status !== "all";
  const total = leadsQuery.data?.total ?? 0;
  const countLabel = `${countryFilterLabel(filters.country)} — ${formatLeadCount(total)}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Lead status" className="inline-flex rounded-full bg-surface-muted p-0.5">
          {(
            [
              ["all", "All"],
              ["working", "Open"],
              ["won", "Purchased"],
              ["lost", "Lost"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={status === value}
              onClick={() => setStatus(value)}
              className={cn(
                "h-7 rounded-full px-3 text-xs font-medium transition-colors",
                status === value ? "bg-surface text-ink shadow-xs" : "text-ink-muted hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p
          className="min-h-5 text-xs text-ink-muted tabular-nums"
          aria-live="polite"
          data-loading={leadsQuery.isFetching ? "true" : undefined}
        >
          {leadsQuery.isLoading && !leadsQuery.data ? "Counting…" : countLabel}
        </p>
        <div className="ml-auto">
          <ColumnsMenu {...columnPrefs.menu} />
        </div>
      </div>

      <BulkActionBar count={selected.length} onClear={() => setSelectionResetKey((k) => k + 1)}>
        {can("leads:delete") ? (
          <ConsoleButton
            size="sm"
            variant="secondary"
            loading={archiveMutation.isPending}
            onClick={() => archiveMutation.mutate(selected.map((l) => l.id))}
          >
            <Archive aria-hidden />
            Archive
          </ConsoleButton>
        ) : null}
        {canAssignLeads ? (
          <Select
            key={selectionResetKey}
            onValueChange={(owner) => {
              void crmApi
                .bulkAssignLeads(selected.map((l) => l.id), owner)
                .then(async () => {
                  await refreshLeads();
                  setSelectionResetKey((k) => k + 1);
                  toast.success(`${selected.length} ${selected.length === 1 ? "lead" : "leads"} reassigned`);
                })
                .catch((err: Error) => toast.error(err.message || "Couldn't reassign leads"));
            }}
          >
            <SelectTrigger className="h-8 w-[160px]" aria-label="Assign owner">
              <SelectValue placeholder="Assign owner" />
            </SelectTrigger>
            <SelectContent>
              {(ownersQuery.data?.data ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </BulkActionBar>

      <DataTable
        columns={columns}
        columnVisibility={columnPrefs.columnVisibility}
        data={leadsQuery.data?.data ?? []}
        loading={leadsQuery.isLoading}
        onRowSelectionChange={setSelected}
        selectionResetKey={selectionResetKey}
        itemLabel="leads"
        onRowClick={(lead) => onOpenLead(lead.id)}
        sorting={sorting}
        onSortingChange={setSorting}
        pagination={{
          page,
          pageSize,
          total: leadsQuery.data?.total ?? 0,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
        emptyTitle={hasFilters ? "No leads match these filters" : "No leads yet"}
        emptyDescription={
          hasFilters
            ? "Try clearing a filter or switching the status above."
            : "Create your first lead. It starts in Created on the pipeline."
        }
        emptyActionLabel={can("leads:create") && !hasFilters && onCreateLead ? "Create lead" : undefined}
        onEmptyAction={can("leads:create") && !hasFilters ? onCreateLead : undefined}
      />
    </div>
  );
}
