"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import {
  DataTable,
  EntityCell,
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
import { stageSlotFromPipeline } from "@/components/ui/stage-rail";
import { useAuth } from "@/features/auth/auth-provider";
import {
  ScopeFilterControls,
  useOwnerOptions,
  useScopeFilters,
} from "@/features/teams/scope-filters";
import { crmApi, type Lead, type Pipeline } from "@/lib/api/crm";
import { LeadFormDialog } from "@/features/leads/lead-form-dialog";
import { AnzscoCombobox } from "@/components/shared/anzsco-combobox";
import { ActivityQuickCreateDialog } from "@/features/activities/activity-quick-create";
import { LeadInsightsPanel } from "@/features/predictions/insight-panels";
import { priorityFromString, stageBadgeClass } from "@/lib/design-tokens";
import { Avatar } from "@/components/ui/console/avatar";
import { NextStepChip } from "@/components/ui/next-step-chip";
import { InlineSelectCell } from "@/components/ui/inline-select-cell";
import { ColumnsMenu } from "@/components/ui/console/toolbar";
import { useColumnVisibility } from "@/lib/column-visibility";
import { LEAD_PRIORITIES } from "@/validations/lead";
import { cn } from "@/lib/utils";

const PRIORITY_OPTIONS = LEAD_PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }));

function formatWhen(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString();
}

function pipelineForLead(lead: Lead, pipelines: Pipeline[]) {
  return (
    pipelines.find((p) => p.id === lead.pipelineId) ??
    pipelines.find((p) => p.stages?.some((s) => s.id === lead.stageId))
  );
}

/** Open stages plus the lead's current one; won and lost stay with Qualify and Convert. */
function stageOptionsForLead(lead: Lead, pipeline: Pipeline | undefined) {
  return (pipeline?.stages ?? [])
    .filter((s) => (!s.isWon && !s.isLost) || s.id === lead.stageId)
    .map((s) => ({ value: s.id, label: s.name }));
}

function stageMetaForLead(lead: Lead, pipelines: Pipeline[]) {
  const pipeline = pipelineForLead(lead, pipelines);
  if (!pipeline?.stages?.length || !lead.stageId) return null;
  const open = pipeline.stages.filter((s) => !s.isWon && !s.isLost);
  const stage = pipeline.stages.find((s) => s.id === lead.stageId);
  if (!stage) return null;
  const position = open.findIndex((s) => s.id === stage.id);
  const slot = stageSlotFromPipeline({
    position: position >= 0 ? position : 0,
    openStageCount: open.length || 1,
    isWon: stage.isWon,
    isLost: stage.isLost,
  });
  return { slot, name: stage.name };
}

export function LeadsTableView() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [search, setSearch] = React.useState(() => searchParams.get("q") ?? "");

  const qParam = searchParams.get("q");
  const [syncedQ, setSyncedQ] = React.useState(qParam);
  if (qParam !== syncedQ) {
    setSyncedQ(qParam);
    if (qParam) setSearch(qParam);
  }
  const [pipelineId, setPipelineId] = React.useState("all");
  const [stageId, setStageId] = React.useState("all");
  const [source, setSource] = React.useState("");
  const [priority, setPriority] = React.useState("all");
  const [leadStatus, setLeadStatus] = React.useState("all");
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

  const scopeFilters = useScopeFilters("leads:view");
  const scopeParams = scopeFilters.params;
  const canEditLeads = can("leads:edit");
  const canAssignLeads = can("leads:assign");
  const ownersQuery = useOwnerOptions(scopeFilters.ownerFilter || canAssignLeads);
  const ownerOptions = React.useMemo(
    () => (ownersQuery.data?.data ?? []).map((u) => ({ value: u.id, label: u.fullName })),
    [ownersQuery.data],
  );
  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "leads"],
    queryFn: () => crmApi.listPipelines("leads"),
  });

  const selectedPipeline = pipelinesQuery.data?.find((p) => p.id === pipelineId);
  const pipelines = React.useMemo(() => pipelinesQuery.data ?? [], [pipelinesQuery.data]);

  const params = React.useMemo(() => {
    const p = new URLSearchParams({ limit: "50", offset: "0", sort: "created", order: "desc" });
    if (search) p.set("q", search);
    for (const [key, value] of scopeParams) p.set(key, value);
    if (pipelineId !== "all") p.set("pipelineId", pipelineId);
    if (stageId !== "all") p.set("stageId", stageId);
    if (source) p.set("source", source);
    if (priority !== "all") p.set("priority", priority);
    if (leadStatus !== "all") p.set("status", leadStatus);
    if (anzscoId) p.set("anzscoId", anzscoId);
    if (tag) p.set("tag", tag);
    if (createdFrom) p.set("createdFrom", createdFrom);
    if (createdTo) p.set("createdTo", createdTo);
    if (inactiveDays) p.set("inactiveDays", inactiveDays);
    return p;
  }, [
    search, scopeParams, pipelineId, stageId, source, priority,
    anzscoId, tag, createdFrom, createdTo, inactiveDays, leadStatus,
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
      toast.error(err.message || "Couldn't archive leads. Check permissions and try again.");
    },
  });

  const refreshLeads = React.useCallback(() => qc.invalidateQueries({ queryKey: ["leads"] }), [qc]);

  const columns = React.useMemo<ColumnDef<Lead>[]>(
    () => [
      createSelectColumn<Lead>(),
      {
        accessorKey: "fullName",
        header: ({ column }) => <SortableHeader column={column} title="Name" />,
        enableHiding: false,
        cell: ({ row }) => (
          <EntityCell
            name={row.original.fullName}
            subtitle={row.original.email ?? row.original.phone ?? undefined}
          >
            <span className="flex shrink-0 items-center gap-2 transition-opacity duration-150 pointer-fine:opacity-0 pointer-fine:group-hover/row:opacity-100 pointer-fine:group-focus-within/row:opacity-100">
              {can("activities:create") ? (
                <button
                  type="button"
                  className="text-meta hover:text-brand"
                  onClick={() => setActivityLeadId(row.original.id)}
                >
                  Activity
                </button>
              ) : null}
              {can("predictions:view") || can("predictions:manage") ? (
                <button
                  type="button"
                  className="text-meta hover:text-brand"
                  onClick={() => setInsightLeadId(row.original.id)}
                >
                  Score
                </button>
              ) : null}
            </span>
          </EntityCell>
        ),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) =>
          row.original.phone ? (
            <span className="font-mono text-caption tabular-nums text-ink-secondary">
              {row.original.phone}
            </span>
          ) : (
            <span className="text-ink-muted">Not added</span>
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
            disabled={!canAssignLeads}
            onSave={async (ownerUserId) => {
              await crmApi.bulkAssignLeads([row.original.id], ownerUserId);
              await refreshLeads();
            }}
          >
            {row.original.ownerName ? (
              <span className="flex min-w-0 items-center gap-2 text-ink-secondary">
                <Avatar name={row.original.ownerName} size="sm" />
                <span className="truncate">{row.original.ownerName}</span>
              </span>
            ) : (
              <span className="text-meta">Unassigned</span>
            )}
          </InlineSelectCell>
        ),
      },
      {
        accessorKey: "stageName",
        header: "Stage",
        cell: ({ row }) => {
          const pipeline = pipelineForLead(row.original, pipelines);
          const meta = stageMetaForLead(row.original, pipelines);
          if (!meta && !row.original.stageName) return "—";
          return (
            <InlineSelectCell
              label="stage"
              value={row.original.stageId}
              options={stageOptionsForLead(row.original, pipeline)}
              disabled={!canEditLeads || !pipeline}
              onSave={async (stageId) => {
                await crmApi.updateLead(row.original.id, {
                  pipelineId: pipeline?.id,
                  stageId,
                  forceUpdate: true,
                });
                await refreshLeads();
              }}
            >
              {meta ? (
                <span
                  className={cn(
                    "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-caption font-medium",
                    stageBadgeClass[meta.slot],
                  )}
                >
                  {meta.name}
                </span>
              ) : (
                <StatusBadge tone="brand">{row.original.stageName}</StatusBadge>
              )}
            </InlineSelectCell>
          );
        },
      },
      {
        id: "anzsco",
        header: "ANZSCO",
        cell: ({ row }) =>
          row.original.anzscoCode ? (
            <span className="text-meta">
              <span className="font-mono text-foreground-muted">{row.original.anzscoCode}</span>{" "}
              <span>{row.original.anzscoTitle}</span>
            </span>
          ) : (
            "—"
          ),
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => (
          <span className="text-sm text-foreground-muted">{row.original.source || "—"}</span>
        ),
      },
      {
        accessorKey: "priority",
        header: ({ column }) => <SortableHeader column={column} title="Priority" />,
        meta: { label: "Priority" },
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
              <span className="inline-flex items-center gap-1.5 capitalize text-ink-secondary">
                {level === "high" || level === "urgent" ? (
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full",
                      level === "urgent" ? "bg-priority-urgent" : "bg-priority-high",
                    )}
                  />
                ) : null}
                {level}
              </span>
            </InlineSelectCell>
          );
        },
      },
      {
        accessorKey: "lastActivityAt",
        header: "Last activity",
        cell: ({ row }) => (
          <span className="text-meta text-data">{formatWhen(row.original.lastActivityAt)}</span>
        ),
      },
      {
        accessorKey: "nextActivityAt",
        header: "Next step",
        cell: ({ row }) => <NextStepChip at={row.original.nextActivityAt} />,
      },
      {
        accessorKey: "ageDays",
        header: ({ column }) => <SortableHeader column={column} title="Age" />,
        meta: { label: "Age" },
        cell: ({ row }) => (
          <span
            className={cn(
              "tabular-nums",
              row.original.ageDays >= 30 ? "font-medium text-ink" : "text-ink-muted",
            )}
            title={row.original.ageDays >= 30 ? "Open for 30 days or more" : undefined}
          >
            {row.original.ageDays}d
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <SortableHeader column={column} title="Created" />,
        meta: { label: "Created" },
        cell: ({ row }) => (
          <span className="text-meta text-data">{formatWhen(row.original.createdAt)}</span>
        ),
      },
    ],
    [can, canAssignLeads, canEditLeads, ownerOptions, ownersQuery.isLoading, pipelines, refreshLeads],
  );
  const columnPrefs = useColumnVisibility("leads", columns);

  if (leadsQuery.isError) {
    return <ErrorState onRetry={() => void leadsQuery.refetch()} />;
  }

  const hasFilters =
    !!search ||
    scopeFilters.active ||
    pipelineId !== "all" ||
    stageId !== "all" ||
    !!source ||
    priority !== "all" ||
    leadStatus !== "all" ||
    !!anzscoId ||
    !!tag ||
    !!createdFrom ||
    !!createdTo ||
    !!inactiveDays;

  const moreCount = [
    priority !== "all",
    !!source,
    !!tag,
    !!anzscoId,
    !!createdFrom || !!createdTo,
    !!inactiveDays,
  ].filter(Boolean).length;

  const total = leadsQuery.data?.total;

  return (
    <div className="space-y-4">
      <PageHeader
        display
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Leads" }]}
        title="Leads"
        description={
          total != null
            ? `${total.toLocaleString()} ${hasFilters ? "matching" : "in your view"} · qualify them, then convert to customers.`
            : "Qualify prospects, then convert them to customers."
        }
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
        className="border-0 bg-transparent p-0"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, email, phone…"
        moreCount={moreCount}
        trailing={<ColumnsMenu {...columnPrefs.menu} />}
        more={
          <>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-[130px]" aria-label="Priority"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {["low", "medium", "high", "urgent"].map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="w-[130px]"
              placeholder="Source"
              aria-label="Source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <Input
              className="w-[110px]"
              placeholder="Tag"
              aria-label="Tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            />
            <div className="w-[220px]">
              <AnzscoCombobox value={anzscoId} onChange={(id) => setAnzscoId(id)} />
            </div>
            <label className="inline-flex items-center gap-1.5 text-meta">
              Created
              <Input
                type="date"
                className="w-[140px]"
                aria-label="Created from"
                value={createdFrom}
                onChange={(e) => setCreatedFrom(e.target.value)}
              />
            </label>
            <label className="inline-flex items-center gap-1.5 text-meta">
              to
              <Input
                type="date"
                className="w-[140px]"
                aria-label="Created to"
                value={createdTo}
                onChange={(e) => setCreatedTo(e.target.value)}
              />
            </label>
            <Input
              className="w-[130px]"
              placeholder="Inactive days"
              aria-label="Inactive for at least (days)"
              inputMode="numeric"
              value={inactiveDays}
              onChange={(e) => setInactiveDays(e.target.value)}
            />
          </>
        }
        onClear={() => {
          setSearch("");
          scopeFilters.reset();
          setPipelineId("all");
          setStageId("all");
          setSource("");
          setPriority("all");
          setLeadStatus("all");
          setAnzscoId(null);
          setTag("");
          setCreatedFrom("");
          setCreatedTo("");
          setInactiveDays("");
        }}
      >
        <ScopeFilterControls filters={scopeFilters} />
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
        <Select value={leadStatus} onValueChange={setLeadStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="inbox">Inbox</SelectItem>
            <SelectItem value="working">Working</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="qualified">Qualified</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      {selected.length > 0 ? (
        <div
          role="region"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-2 rounded-control bg-brand-soft px-3 py-1.5"
        >
          <span className="mr-1 text-body text-brand-ink">
            <strong className="font-semibold tabular-nums">{selected.length}</strong> selected
          </span>
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
                {(ownersQuery.data?.data ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        columnVisibility={columnPrefs.columnVisibility}
        data={leadsQuery.data?.data ?? []}
        loading={leadsQuery.isLoading}
        searchValue={search}
        onRowSelectionChange={setSelected}
        pageSize={10}
        itemLabel="leads"
        onRowClick={(lead) => setEditLead(lead)}
        emptyTitle={hasFilters ? "No leads match these filters" : "No leads yet"}
        emptyDescription={
          hasFilters
            ? "Try clearing a filter or two. The clear button sits next to search."
            : "Add your first lead and it will show up here, ready to qualify."
        }
        emptyActionLabel={can("leads:create") && !hasFilters ? "New lead" : undefined}
        onEmptyAction={can("leads:create") && !hasFilters ? () => setCreateOpen(true) : undefined}
      />

      {insightLeadId ? (
        <div className="rounded-card border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-section">
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
        defaultLinkType="lead"
        onCreated={() => void qc.invalidateQueries({ queryKey: ["leads"] })}
      />
    </div>
  );
}
