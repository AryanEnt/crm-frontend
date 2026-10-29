"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { useAuth } from "@/features/auth/auth-provider";
import { CreateLeadSheet } from "@/features/leads/create/create-lead-sheet";
import { isNurturingPipeline } from "@/features/leads/lead-board-state";
import { LeadDetailPanel } from "@/features/leads/lead-detail-panel";
import { useLeadMove } from "@/features/leads/lead-move";
import { useLeadUrl } from "@/features/leads/use-lead-url";
import type { LeadBoardCard, LeadBoardStage } from "@/lib/api/crm";
import { ClosedBoard } from "./closed-board";
import { ClosedLeadsTable } from "./closed-leads-table";
import { PipelineBoard } from "./pipeline-board";
import { PipelineEmpty } from "./pipeline-empty";
import {
  clearAllFilters,
  closedStatusLabel,
  hasNarrowingFilters,
  isClosedStatus,
  parsePipelineFilters,
  writePipelineFilters,
  type ClosedOutcome,
  type PipelineFilters,
} from "./pipeline-filters";
import { PipelineHeader } from "./pipeline-header";
import { PipelineBoardSkeleton } from "./pipeline-skeleton";
import { PipelineStats, PipelineStatsSkeleton } from "./pipeline-stats";
import { PipelineToolbar } from "./pipeline-toolbar";
import { CLOSED_PAGE_SIZE, usePipelineLeads } from "./use-pipeline-leads";

/**
 * Pipeline: the same lead records as /leads, grouped by stage. Board totals, status
 * counts and the Won/Lost tables all come from one scoped query set, so they agree.
 */
export function PipelinePage() {
  const router = useRouter();
  const pathname = usePathname();
  const { can } = useAuth();
  const { searchParams, leadId, openLead, closeLead } = useLeadUrl();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [pageSize, setPageSize] = React.useState(CLOSED_PAGE_SIZE);

  const filters = React.useMemo(() => parsePipelineFilters(new URLSearchParams(searchParams.toString())), [searchParams]);
  const setFilters = React.useCallback(
    (next: PipelineFilters) => {
      const qs = writePipelineFilters(next, new URLSearchParams(searchParams.toString())).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const data = usePipelineLeads(filters, pageSize);
  const canEdit = can("leads:edit");
  const canCreate = can("leads:create");
  const filtered = hasNarrowingFilters(filters);
  const nurturing = isNurturingPipeline(data.pipelineId);

  const move = useLeadMove({ onOptimistic: data.optimisticMove, onChanged: data.settleMove });
  const requestMove = (lead: LeadBoardCard, to: LeadBoardStage) =>
    move.request({
      leadId: lead.id,
      leadName: lead.fullName,
      status: lead.status,
      fromStageId: lead.stageId,
      to,
      pipelineId: data.pipelineId,
      lostReason: lead.lostReason,
    });

  const newLeadButton = canCreate ? (
    <Button onClick={() => setCreateOpen(true)}>
      <Plus aria-hidden />
      New lead
    </Button>
  ) : null;
  const clearButton = (
    <Button variant="outline" onClick={() => setFilters(clearAllFilters(filters))}>
      Clear filters
    </Button>
  );

  const setStatus = (status: PipelineFilters["status"]) => setFilters({ ...filters, status, page: 1 });

  const renderClosed = (status: ClosedOutcome) => {
    const label = closedStatusLabel(status, nurturing).toLowerCase();
    const empty = (
      <PipelineEmpty
        title={filtered ? `No ${label} leads match these filters` : status === "lost" ? "No lost leads yet" : `No ${label} leads yet`}
        description={
          filtered
            ? "Try a wider date range or removing a filter."
            : status === "complete"
              ? "Drop a lead onto Complete, and it shows up here."
              : status === "won"
                ? "Drag a lead onto Won, or choose Mark as won from its menu, and it shows up here."
                : "Leads marked as lost appear here with their reason, so patterns are easy to spot."
        }
        action={
          filtered ? (
            clearButton
          ) : (
            <Button variant="outline" onClick={() => setStatus("open")}>
              View open leads
            </Button>
          )
        }
      />
    );
    if (filters.view === "board") {
      if (data.closed.isError) return <ErrorState title={`Couldn't load ${status} leads`} onRetry={data.closed.retry} />;
      if (!data.closed.isLoading && data.closed.total === 0) return empty;
      return <ClosedBoard data={data} filters={filters} canEdit={canEdit} onOpenLead={openLead} onMove={requestMove} />;
    }
    return (
      <ClosedLeadsTable
        kind={status}
        rows={data.closed.rows}
        total={data.closed.total}
        loading={data.closed.isLoading}
        error={data.closed.isError}
        onRetry={data.closed.retry}
        sort={filters.sort}
        order={filters.order}
        onSortChange={(sort, order) => setFilters({ ...filters, sort, order, page: 1 })}
        page={filters.page}
        pageSize={pageSize}
        onPageChange={(page) => setFilters({ ...filters, page })}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setFilters({ ...filters, page: 1 });
        }}
        onOpenLead={openLead}
        empty={empty}
      />
    );
  };

  return (
    <div className="space-y-6 pb-10 text-ink">
      <PipelineHeader
        pipelines={data.pipelines}
        pipelineId={data.pipelineId}
        onPipelineChange={(id) => {
          const next: PipelineFilters = { ...filters, pipeline: id, page: 1 };
          if (!isNurturingPipeline(id) && next.status === "complete") next.status = "won";
          setFilters(next);
        }}
        onCreate={canCreate ? () => setCreateOpen(true) : undefined}
      />

      {data.isError ? (
        <ErrorState title="Couldn't load the pipeline" onRetry={data.retry} />
      ) : data.noPipeline ? (
        <PipelineEmpty
          title="No lead pipeline yet"
          description="An admin needs to set one up in Pipelines & Stages before leads can be tracked here."
        />
      ) : (
        <>
          {data.isLoading ? (
            <PipelineStatsSkeleton />
          ) : (
            <PipelineStats
              totals={data.totals}
              currency={data.currency}
              status={filters.status}
              nurturing={nurturing}
              onStatus={setStatus}
            />
          )}

          <PipelineToolbar
            filters={filters}
            counts={data.isLoading ? null : data.counts}
            currency={data.currency}
            nurturing={nurturing}
            onChange={setFilters}
          />

          <div aria-busy={data.isFetching || undefined}>
            {data.isLoading ? (
              <PipelineBoardSkeleton />
            ) : isClosedStatus(filters.status) ? (
              renderClosed(filters.status)
            ) : (
              <BoardOrEmpty
                visibleCount={filters.status === "all" ? data.counts.all : data.counts.open}
                status={filters.status}
                filtered={filtered}
                totalCount={data.totals.totalCount}
                newLeadButton={newLeadButton}
                clearButton={clearButton}
              >
                <PipelineBoard
                  data={data}
                  showClosedColumns={filters.status === "all"}
                  canEdit={canEdit}
                  nurturing={nurturing}
                  onOpenLead={openLead}
                  onMove={requestMove}
                />
              </BoardOrEmpty>
            )}
          </div>
        </>
      )}

      {move.dialogs}
      <CreateLeadSheet open={createOpen} onOpenChange={setCreateOpen} pipelineId={data.pipelineId || undefined} />
      <LeadDetailPanel leadId={leadId} onOpenChange={(open) => !open && closeLead()} />
    </div>
  );
}

function BoardOrEmpty({
  visibleCount,
  status,
  filtered,
  totalCount,
  newLeadButton,
  clearButton,
  children,
}: {
  visibleCount: number;
  status: PipelineFilters["status"];
  filtered: boolean;
  totalCount: number;
  newLeadButton: React.ReactNode;
  clearButton: React.ReactNode;
  children: React.ReactNode;
}) {
  if (visibleCount > 0) return <>{children}</>;
  if (filtered) {
    return (
      <PipelineEmpty
        title="No leads match these filters"
        description="Try removing a filter, or switch the status to see won and lost leads."
        action={clearButton}
      />
    );
  }
  if (status === "open" && totalCount > 0) {
    return (
      <PipelineEmpty
        title="No open leads right now"
        description="Everything in this pipeline has been won or lost. Add a lead to keep things moving."
        action={newLeadButton}
      />
    );
  }
  return (
    <PipelineEmpty
      title="No leads in this pipeline yet"
      description="Add your first lead. It starts in Created and moves across as you work it."
      action={newLeadButton}
    />
  );
}
