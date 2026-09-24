"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import {
  DataTable,
  SortableHeader,
  createSelectColumn,
} from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { useAuth } from "@/features/auth/auth-provider";
import { adminApi } from "@/lib/api/admin";
import { crmApi, type Lead } from "@/lib/api/crm";
import { LeadFormDialog } from "@/features/leads/lead-form-dialog";
import { AnzscoCombobox } from "@/components/shared/anzsco-combobox";
import { ActivityQuickCreateDialog } from "@/features/activities/activity-quick-create";
import { LeadInsightsPanel } from "@/features/predictions/insight-panels";
import {
  TeamMemberFilterChip,
  useTeamMemberFilter,
} from "@/features/teams/team-member-filter";

const priorityTone = (p: string) =>
  p === "urgent" ? "danger" : p === "high" ? "warning" : p === "low" ? "neutral" : "brand";

function formatWhen(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString();
}

export function LeadsTableView() {
  const { can, user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [ownerUserId, setOwnerUserId] = React.useState("all");
  const [teamId, setTeamId] = React.useState("all");
  const [pipelineId, setPipelineId] = React.useState("all");
  const [stageId, setStageId] = React.useState("all");
  const [source, setSource] = React.useState("");
  const [priority, setPriority] = React.useState("all");
  const [anzscoId, setAnzscoId] = React.useState<string | null>(null);
  const [tag, setTag] = React.useState("");
  const [createdFrom, setCreatedFrom] = React.useState("");
  const [createdTo, setCreatedTo] = React.useState("");
  const [inactiveDays, setInactiveDays] = React.useState("");
  const [selected, setSelected] = React.useState<Lead[]>([]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editLead, setEditLead] = React.useState<Lead | null>(null);
  const [activityLeadId, setActivityLeadId] = React.useState<string | null>(null);
  const [insightLeadId, setInsightLeadId] = React.useState<string | null>(null);

  const isTeamLead = user?.roleCode === "sales_manager";
  const { salesExecutiveId, setSalesExecutiveId } = useTeamMemberFilter(isTeamLead);

  const usersQuery = useQuery({
    queryKey: ["users", "lead-filters"],
    queryFn: () => adminApi.listUsers(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled: !isTeamLead,
  });
  const teamsQuery = useQuery({
    queryKey: ["teams", "lead-filters"],
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled: !isTeamLead,
  });
  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "leads"],
    queryFn: () => crmApi.listPipelines("leads"),
  });

  const selectedPipeline = pipelinesQuery.data?.find((p) => p.id === pipelineId);

  const params = React.useMemo(() => {
    const p = new URLSearchParams({ limit: "50", offset: "0", sort: "created", order: "desc" });
    if (search) p.set("q", search);
    if (isTeamLead) {
      if (salesExecutiveId !== "all") p.set("salesExecutiveId", salesExecutiveId);
    } else {
      if (ownerUserId !== "all") p.set("ownerUserId", ownerUserId);
      if (teamId !== "all") p.set("teamId", teamId);
    }
    if (pipelineId !== "all") p.set("pipelineId", pipelineId);
    if (stageId !== "all") p.set("stageId", stageId);
    if (source) p.set("source", source);
    if (priority !== "all") p.set("priority", priority);
    if (anzscoId) p.set("anzscoId", anzscoId);
    if (tag) p.set("tag", tag);
    if (createdFrom) p.set("createdFrom", createdFrom);
    if (createdTo) p.set("createdTo", createdTo);
    if (inactiveDays) p.set("inactiveDays", inactiveDays);
    return p;
  }, [
    search, ownerUserId, teamId, pipelineId, stageId, source, priority,
    anzscoId, tag, createdFrom, createdTo, inactiveDays, isTeamLead, salesExecutiveId,
  ]);

  const leadsQuery = useQuery({
    queryKey: ["leads", params.toString()],
    queryFn: () => crmApi.listLeads(params),
  });

  const archiveMutation = useMutation({
    mutationFn: (ids: string[]) => crmApi.bulkArchiveLeads(ids, true),
    onSuccess: (_data, ids) => {
      void qc.invalidateQueries({ queryKey: ["leads"] });
      setSelected([]);
      toast.success(ids.length === 1 ? "Lead archived" : `${ids.length} leads archived`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not archive leads");
    },
  });

  const columns = React.useMemo<ColumnDef<Lead>[]>(
    () => [
      createSelectColumn<Lead>(),
      {
        accessorKey: "fullName",
        header: ({ column }) => <SortableHeader column={column} title="Name" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-left font-medium text-foreground hover:text-brand-dark"
              onClick={() => setEditLead(row.original)}
            >
              {row.original.fullName}
            </button>
            {can("activities:create") ? (
              <button
                type="button"
                className="text-[10px] text-foreground-subtle hover:text-brand-dark"
                onClick={() => setActivityLeadId(row.original.id)}
              >
                +act
              </button>
            ) : null}
            {can("predictions:view") || can("predictions:manage") ? (
              <button
                type="button"
                className="text-[10px] text-foreground-subtle hover:text-brand-dark"
                onClick={() => setInsightLeadId(row.original.id)}
              >
                score
              </button>
            ) : null}
          </div>
        ),
      },
      {
        id: "contact",
        header: "Contact",
        cell: ({ row }) => (
          <div className="text-xs text-foreground-muted">
            <div>{row.original.email ?? "—"}</div>
            <div>{row.original.phone ?? ""}</div>
          </div>
        ),
      },
      {
        accessorKey: "ownerName",
        header: "Owner",
        cell: ({ row }) => row.original.ownerName ?? "—",
      },
      {
        accessorKey: "pipelineName",
        header: "Pipeline",
        cell: ({ row }) => row.original.pipelineName ?? "—",
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
        id: "anzsco",
        header: "ANZSCO",
        cell: ({ row }) =>
          row.original.anzscoCode ? (
            <span className="text-xs">
              <span className="font-mono text-foreground-muted">{row.original.anzscoCode}</span>{" "}
              <span className="text-foreground-muted">{row.original.anzscoTitle}</span>
            </span>
          ) : (
            "—"
          ),
      },
      { accessorKey: "source", header: "Source", cell: ({ row }) => row.original.source || "—" },
      {
        accessorKey: "priority",
        header: ({ column }) => <SortableHeader column={column} title="Priority" />,
        cell: ({ row }) => (
          <StatusBadge tone={priorityTone(row.original.priority)}>
            {row.original.priority}
          </StatusBadge>
        ),
      },
      {
        accessorKey: "lastActivityAt",
        header: "Last Activity",
        cell: ({ row }) => (
          <span className="text-xs text-foreground-subtle">
            {formatWhen(row.original.lastActivityAt)}
          </span>
        ),
      },
      {
        accessorKey: "nextActivityAt",
        header: "Next Activity",
        cell: ({ row }) => (
          <span className="text-xs text-foreground-subtle">
            {formatWhen(row.original.nextActivityAt)}
          </span>
        ),
      },
      {
        accessorKey: "ageDays",
        header: ({ column }) => <SortableHeader column={column} title="Age" />,
        cell: ({ row }) => `${row.original.ageDays}d`,
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <SortableHeader column={column} title="Created" />,
        cell: ({ row }) => (
          <span className="text-xs text-foreground-subtle">
            {formatWhen(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [can],
  );

  if (leadsQuery.isError) {
    return <ErrorState onRetry={() => void leadsQuery.refetch()} />;
  }

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Leads" }]}
        title="Leads"
        description="Capture and qualify prospects before conversion to customers."
        actions={
          <div className="flex gap-2">
            {can("activities:create") ? (
              <Button size="sm" variant="outline" onClick={() => setActivityLeadId("pick")}>
                Activity
              </Button>
            ) : null}
            {can("leads:create") ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-3.5" />
                New lead
              </Button>
            ) : null}
          </div>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, email, phone…"
        onClear={() => {
          setSearch("");
          setOwnerUserId("all");
          setTeamId("all");
          setSalesExecutiveId("all");
          setPipelineId("all");
          setStageId("all");
          setSource("");
          setPriority("all");
          setAnzscoId(null);
          setTag("");
          setCreatedFrom("");
          setCreatedTo("");
          setInactiveDays("");
        }}
      >
        {isTeamLead ? (
          <TeamMemberFilterChip value={salesExecutiveId} onChange={setSalesExecutiveId} />
        ) : (
          <>
            <Select value={ownerUserId} onValueChange={setOwnerUserId}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Owner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All owners</SelectItem>
                {(usersQuery.data?.data ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Team" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams</SelectItem>
                {(teamsQuery.data?.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        <Select
          value={pipelineId}
          onValueChange={(v) => {
            setPipelineId(v);
            setStageId("all");
          }}
        >
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Pipeline" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All pipelines</SelectItem>
            {(pipelinesQuery.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stageId} onValueChange={setStageId}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {(selectedPipeline?.stages ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {["low", "medium", "high", "urgent"].map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-[120px]"
          placeholder="Source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
        <Input
          className="w-[110px]"
          placeholder="Tag"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
        <div className="w-[200px]">
          <AnzscoCombobox value={anzscoId} onChange={(id) => setAnzscoId(id)} />
        </div>
        <Input type="date" className="w-[140px]" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} />
        <Input type="date" className="w-[140px]" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} />
        <Input
          className="w-[120px]"
          placeholder="Inactive days"
          value={inactiveDays}
          onChange={(e) => setInactiveDays(e.target.value)}
        />
      </FilterBar>

      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
          <span className="text-xs text-foreground-muted">{selected.length} selected</span>
          {can("leads:delete") ? (
            <Button
              size="sm"
              variant="outline"
              loading={archiveMutation.isPending}
              onClick={() => archiveMutation.mutate(selected.map((l) => l.id))}
            >
              Archive
            </Button>
          ) : null}
          {can("leads:assign") ? (
            <Select
              onValueChange={(owner) => {
                void crmApi
                  .bulkAssignLeads(selected.map((l) => l.id), owner)
                  .then(() => qc.invalidateQueries({ queryKey: ["leads"] }));
              }}
            >
              <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Assign owner" /></SelectTrigger>
              <SelectContent>
                {(usersQuery.data?.data ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={leadsQuery.data?.data ?? []}
        loading={leadsQuery.isLoading}
        searchValue={search}
        onRowSelectionChange={setSelected}
        pageSize={10}
      />

      {insightLeadId ? (
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Scoring:{" "}
              {leadsQuery.data?.data.find((l) => l.id === insightLeadId)?.fullName ?? insightLeadId}
            </p>
            <Button size="sm" variant="outline" onClick={() => setInsightLeadId(null)}>
              Close
            </Button>
          </div>
          <LeadInsightsPanel leadId={insightLeadId} />
        </div>
      ) : null}

      <LeadFormDialog
        key={createOpen ? "create" : "create-closed"}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["leads"] })}
      />
      <LeadFormDialog
        key={editLead?.id ?? "edit-closed"}
        open={!!editLead}
        onOpenChange={(open) => !open && setEditLead(null)}
        initial={editLead}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["leads"] })}
      />
      <ActivityQuickCreateDialog
        open={!!activityLeadId && activityLeadId !== "pick"}
        onOpenChange={(o) => !o && setActivityLeadId(null)}
        context={activityLeadId && activityLeadId !== "pick" ? { leadId: activityLeadId } : undefined}
        onCreated={() => void qc.invalidateQueries({ queryKey: ["leads"] })}
      />
      <ActivityQuickCreateDialog
        open={activityLeadId === "pick"}
        onOpenChange={(o) => !o && setActivityLeadId(null)}
        onCreated={() => void qc.invalidateQueries({ queryKey: ["leads"] })}
      />
    </div>
  );
}
