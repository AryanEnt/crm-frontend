"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { DataTable, EntityCell, SortableHeader } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/error-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi, type Deal } from "@/lib/api/crm";
import { DealQuickCreateDrawer } from "@/features/deals/deal-quick-create";
import { ScopeFilterControls, useOwnerOptions, useScopeFilters } from "@/features/teams/scope-filters";
import { InlineSelectCell } from "@/components/ui/inline-select-cell";
import { ColumnsMenu } from "@/components/ui/console/toolbar";
import { useColumnVisibility } from "@/lib/column-visibility";
import { DEAL_PRIORITIES } from "@/validations/deal";

const PRIORITY_OPTIONS = DEAL_PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }));

const attentionLabel: Record<string, string> = {
  no_next_activity: "No next activity",
  no_recent_activity: "No recent activity",
  attention_needed: "Attention needed",
  over_sla: "Over SLA",
};

function formatMoney(v?: number | null, currency = "AUD") {
  if (v == null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(v);
}

export function DealsTableView({
  viewToggle,
  pipelineId: pipelineIdProp,
  onPipelineIdChange,
}: {
  viewToggle?: React.ReactNode;
  pipelineId?: string;
  onPipelineIdChange?: (id: string) => void;
}) {
  const { can, user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const canEditDeals = can("deals:edit");
  // The API ignores owner changes from other roles.
  const canAssignOwner =
    canEditDeals && (user?.roleCode === "sales_manager" || user?.roleCode === "super_admin");
  const ownersQuery = useOwnerOptions(canAssignOwner);
  const ownerOptions = React.useMemo(
    () => (ownersQuery.data?.data ?? []).map((u) => ({ value: u.id, label: u.fullName })),
    [ownersQuery.data],
  );
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("open");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [localPipelineId, setLocalPipelineId] = React.useState("");
  const setPipelineId = onPipelineIdChange ?? setLocalPipelineId;
  const scopeFilters = useScopeFilters("deals:view");
  const scopeParams = scopeFilters.params;

  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "sales-board"],
    queryFn: () => crmApi.listPipelines("sales"),
  });

  const preferredPipelineId =
    pipelinesQuery.data?.find((p) => p.name === "Development Pipeline")?.id ??
    pipelinesQuery.data?.find((p) => p.isDefault)?.id ??
    pipelinesQuery.data?.[0]?.id ??
    "";
  const selectedPipelineId = pipelineIdProp ?? localPipelineId;
  const activePipelineId = selectedPipelineId || preferredPipelineId;

  const params = React.useMemo(() => {
    const p = new URLSearchParams({ limit: "50", offset: "0" });
    if (search) p.set("q", search);
    if (activePipelineId) p.set("pipelineId", activePipelineId);
    if (statusFilter) p.set("status", statusFilter);
    for (const [key, value] of scopeParams) p.set(key, value);
    return p;
  }, [search, activePipelineId, scopeParams, statusFilter]);

  const dealsQuery = useQuery({
    queryKey: ["deals", params.toString()],
    queryFn: () => crmApi.listDeals(params),
  });

  const refreshDeals = React.useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["deals"] });
    void qc.invalidateQueries({ queryKey: ["deal-board"] });
  }, [qc]);

  const columns = React.useMemo<ColumnDef<Deal>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => <SortableHeader column={column} title="Deal" />,
        enableHiding: false,
        cell: ({ row }) => (
          <EntityCell
            name={
              <Link href={`/deals/${row.original.id}`} className="hover:text-brand">
                {row.original.title}
              </Link>
            }
            avatarName={row.original.customerName || row.original.title}
            subtitle={row.original.customerName}
          />
        ),
      },
      {
        accessorKey: "ownerName",
        header: "Owner",
        cell: ({ row }) => (
          <InlineSelectCell
            label="owner"
            value={row.original.ownerUserId}
            options={ownerOptions}
            loading={ownersQuery.isLoading}
            disabled={!canAssignOwner}
            onSave={async (ownerUserId) => {
              await crmApi.updateDeal(row.original.id, { ownerUserId });
              await refreshDeals();
            }}
          >
            {row.original.ownerName ?? "—"}
          </InlineSelectCell>
        ),
      },
      {
        accessorKey: "stageName",
        header: "Stage",
        cell: ({ row }) =>
          row.original.stageName ? (
            <StatusBadge tone="brand">{row.original.stageName}</StatusBadge>
          ) : (
            "—"
          ),
      },
      {
        accessorKey: "value",
        header: "Value",
        cell: ({ row }) => formatMoney(row.original.value, row.original.currency),
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => (
          <InlineSelectCell
            label="priority"
            value={row.original.priority}
            options={PRIORITY_OPTIONS}
            disabled={!canEditDeals}
            onSave={async (priority) => {
              await crmApi.updateDeal(row.original.id, { priority });
              await refreshDeals();
            }}
          >
            <StatusBadge tone="neutral">{row.original.priority}</StatusBadge>
          </InlineSelectCell>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            tone={
              row.original.status === "won"
                ? "success"
                : row.original.status === "lost"
                  ? "danger"
                  : "brand"
            }
          >
            {row.original.status}
          </StatusBadge>
        ),
      },
      {
        id: "nextActivity",
        header: "Next activity",
        cell: ({ row }) => {
          const missing = row.original.status === "open" && !row.original.nextActivityAt;
          return (
            <span className={missing ? "text-xs font-medium text-warning" : "text-xs"}>
              {missing
                ? "None"
                : row.original.nextActivityAt
                  ? new Date(row.original.nextActivityAt).toLocaleDateString()
                  : "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "attention",
        header: "Health",
        cell: ({ row }) =>
          row.original.attention ? (
            <span className="text-xs text-warning">
              {attentionLabel[row.original.attention] ?? row.original.attention}
            </span>
          ) : (
            <span className="text-xs text-foreground-subtle">On track</span>
          ),
      },
      {
        accessorKey: "ageDays",
        header: "Age",
        cell: ({ row }) => `${row.original.ageDays}d`,
      },
    ],
    [canAssignOwner, canEditDeals, ownerOptions, ownersQuery.isLoading, refreshDeals],
  );
  const columnPrefs = useColumnVisibility("deals", columns);

  if (dealsQuery.isError) {
    return <ErrorState onRetry={() => void dealsQuery.refetch()} />;
  }

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Deals" }]}
        title="Deals"
        description="Scan and filter every opportunity. Switch to the board to move stages."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {viewToggle}
            <Select value={activePipelineId || undefined} onValueChange={setPipelineId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select pipeline" />
              </SelectTrigger>
              <SelectContent>
                {(pipelinesQuery.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {can("deals:create") ? (
              <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!activePipelineId}>
                <Plus className="size-3.5" />
                New deal
              </Button>
            ) : null}
          </div>
        }
      />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search deals or customers…"
        trailing={<ColumnsMenu {...columnPrefs.menu} />}
        onClear={() => {
          setSearch("");
          scopeFilters.reset();
          setStatusFilter("open");
        }}
      >
        <ScopeFilterControls filters={scopeFilters} />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="won">Won</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>
      <DataTable
        columns={columns}
        columnVisibility={columnPrefs.columnVisibility}
        data={dealsQuery.data?.data ?? []}
        loading={dealsQuery.isLoading}
        searchValue={search}
        pageSize={10}
        itemLabel="deals"
        onRowClick={(deal) => router.push(`/deals/${deal.id}`)}
      />
      <DealQuickCreateDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultPipelineId={activePipelineId}
        onCreated={() => {
          void qc.invalidateQueries({ queryKey: ["deals"] });
          void qc.invalidateQueries({ queryKey: ["deal-board"] });
        }}
      />
    </div>
  );
}
