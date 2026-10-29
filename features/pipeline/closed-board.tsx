"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { formatLeadMoneyCompact } from "@/features/leads/lead-format";
import { crmApi, type Lead, type LeadBoardCard, type LeadBoardStage } from "@/lib/api/crm";
import { closedColumns, type ClosedColumn } from "./closed-range";
import { PipelineColumn } from "./pipeline-column";
import { closedLeadsParams, type PipelineFilters } from "./pipeline-filters";
import { stageSlot } from "./pipeline-ui";
import type { PipelineData } from "./use-pipeline-leads";

const PAGE_SIZE = 25;

export function leadToCard(lead: Lead): LeadBoardCard {
  return {
    id: lead.id,
    fullName: lead.fullName,
    employer: lead.employer ?? "",
    phone: lead.phone ?? null,
    email: lead.email ?? null,
    potentialValue: lead.potentialValue ?? null,
    currency: lead.currency ?? "AUD",
    stageId: lead.stageId ?? null,
    status: lead.status,
    ownerUserId: lead.ownerUserId ?? null,
    ownerName: lead.ownerName ?? null,
    priority: lead.priority,
    tags: lead.tags ?? [],
    lastActivityAt: lead.lastActivityAt ?? null,
    nextActivityAt: lead.nextActivityAt ?? null,
    nextActivityTitle: null,
    nextActivityType: null,
    expectedCloseAt: lead.expectedCloseAt ?? null,
    stageEnteredAt: lead.stageEnteredAt ?? lead.wonAt ?? lead.lostAt ?? lead.createdAt,
    wonAt: lead.wonAt ?? null,
    lostAt: lead.lostAt ?? null,
    lostReason: lead.lostReason ?? "",
  };
}

/** Won or Lost leads as a kanban, one column per how long ago they closed. */
export function ClosedBoard({
  data,
  filters,
  canEdit,
  onOpenLead,
  onMove,
}: {
  data: PipelineData;
  filters: PipelineFilters;
  canEdit: boolean;
  onOpenLead: (leadId: string) => void;
  onMove: (lead: LeadBoardCard, to: LeadBoardStage) => void;
}) {
  // Won lists by won_at and only needs a Won stage for column chrome; Lost still needs its stage.
  const outcome =
    data.outcomeStage ??
    (filters.status === "won"
      ? ({
          id: "won",
          name: "Won",
          position: 0,
          isWon: true,
          isLost: false,
          probability: 100,
          visualAccent: "",
          requiredFields: [],
          requiredActivities: [],
          requiredDocuments: [],
          count: 0,
          totalValue: 0,
          hasMore: false,
          leads: [],
        } satisfies LeadBoardStage)
      : null);
  if (!outcome) return null;
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-4 crm-scroll">
      {closedColumns(data.closedRange, data.now).map((column) => (
        <ClosedBoardColumn
          key={column.id}
          column={column}
          outcome={outcome}
          data={data}
          filters={filters}
          canEdit={canEdit}
          onOpenLead={onOpenLead}
          onMove={onMove}
        />
      ))}
    </div>
  );
}

function ClosedBoardColumn({
  column,
  outcome,
  data,
  filters,
  canEdit,
  onOpenLead,
  onMove,
}: {
  column: ClosedColumn;
  outcome: LeadBoardStage;
  data: PipelineData;
  filters: PipelineFilters;
  canEdit: boolean;
  onOpenLead: (leadId: string) => void;
  onMove: (lead: LeadBoardCard, to: LeadBoardStage) => void;
}) {
  const params = (offset: number) =>
    closedLeadsParams(
      data.pipelineId,
      outcome.id,
      filters,
      column.interval,
      PAGE_SIZE,
      offset,
      filters.status === "complete" ? "complete" : outcome.isWon ? "won" : "lost",
    );
  const query = useInfiniteQuery({
    queryKey: ["leads", "pipeline-closed-board", params(0).toString()],
    queryFn: ({ pageParam }) => crmApi.listLeads(params(pageParam)),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.data.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    placeholderData: (prev) => prev,
  });

  const leads = query.data?.pages.flatMap((p) => p.data.map(leadToCard)) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;
  const value = leads.reduce((sum, l) => sum + (l.potentialValue ?? 0), 0);
  const hasMore = Boolean(query.hasNextPage);
  const stage: LeadBoardStage = {
    ...outcome,
    id: `${outcome.id}:${column.id}`,
    name: column.label,
    count: total,
    totalValue: value,
    hasMore,
    leads,
  };

  const subtitle = query.isLoading
    ? "Loading…"
    : total === 0
      ? "Nothing here"
      : value === 0
        ? "No value recorded"
        : hasMore
          ? `${formatLeadMoneyCompact(value, data.currency)} in the first ${leads.length}`
          : formatLeadMoneyCompact(value, data.currency);

  return (
    <PipelineColumn
      stage={stage}
      stages={data.stages}
      slot={stageSlot(outcome, data.stages)}
      currency={data.currency}
      canEdit={canEdit}
      dndEnabled={false}
      loadingMore={query.isFetchingNextPage}
      onLoadMore={() => void query.fetchNextPage()}
      onOpen={onOpenLead}
      onMove={onMove}
      subtitle={subtitle}
      emptyText={
        query.isError
          ? "Couldn't load these leads. Refresh to try again."
          : query.isLoading
            ? "Loading…"
            : `No ${filters.status === "complete" ? "complete" : outcome.isWon ? "won" : "lost"} leads in this period`
      }
    />
  );
}
