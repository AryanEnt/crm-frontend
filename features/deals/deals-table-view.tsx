"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
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
import {
  TeamMemberFilterChip,
  useTeamMemberFilter,
} from "@/features/teams/team-member-filter";

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
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("open");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [localPipelineId, setLocalPipelineId] = React.useState("");
  const setPipelineId = onPipelineIdChange ?? setLocalPipelineId;
  const isTeamLead = user?.roleCode === "sales_manager";
  const { salesExecutiveId, setSalesExecutiveId } = useTeamMemberFilter(isTeamLead);

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
    if (isTeamLead && salesExecutiveId !== "all") p.set("salesExecutiveId", salesExecutiveId);
    return p;
  }, [search, activePipelineId, isTeamLead, salesExecutiveId, statusFilter]);

  const dealsQuery = useQuery({
    queryKey: ["deals", params.toString()],
    queryFn: () => crmApi.listDeals(params),
  });

  const columns = React.useMemo<ColumnDef<Deal>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => <SortableHeader column={column} title="Deal" />,
        cell: ({ row }) => (
          <Link
            href={`/deals/${row.original.id}`}
            className="font-medium text-foreground hover:text-brand-dark"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: "customerName",
        header: "Customer",
      },
      {
        accessorKey: "ownerName",
        header: "Owner",
        cell: ({ row }) => row.original.ownerName ?? "—",
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
        cell: ({ row }) => <StatusBadge tone="neutral">{row.original.priority}</StatusBadge>,
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
    [],
  );

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
        onClear={() => {
          setSearch("");
          setSalesExecutiveId("all");
          setStatusFilter("open");
        }}
      >
        {isTeamLead ? (
          <TeamMemberFilterChip value={salesExecutiveId} onChange={setSalesExecutiveId} />
        ) : null}
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
        data={dealsQuery.data?.data ?? []}
        loading={dealsQuery.isLoading}
        searchValue={search}
        pageSize={10}
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
