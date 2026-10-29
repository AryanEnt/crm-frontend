"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  appendStagePage,
  applyPendingMoves,
  moveCard,
  type PendingMoves,
} from "@/features/leads/lead-board-state";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi, type LeadBoard, type LeadBoardStage } from "@/lib/api/crm";
import { closedInterval } from "./closed-range";
import { boardParams, closedListParams, type PipelineFilters } from "./pipeline-filters";
import { derivePipelineTotals, statusCounts } from "./pipeline-totals";

export const CLOSED_PAGE_SIZE = 25;

/** Most common currency among loaded cards; AUD when there are none. */
function primaryCurrency(board: LeadBoard | undefined): string {
  const counts = new Map<string, number>();
  for (const s of board?.stages ?? []) {
    for (const l of s.leads) if (l.currency) counts.set(l.currency, (counts.get(l.currency) ?? 0) + 1);
  }
  let best = "AUD";
  let n = 0;
  for (const [c, k] of counts) {
    if (k > n) {
      best = c;
      n = k;
    }
  }
  return best;
}

/**
 * Everything the Pipeline page reads: the board (one request, server-scoped to the
 * caller's role), totals derived from its column aggregates, and the Won/Lost list
 * built from the same filters so its total matches the board count.
 */
export function usePipelineLeads(filters: PipelineFilters, closedPageSize = CLOSED_PAGE_SIZE) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const timeZone = user?.timezone || undefined;
  // Fixed while the page is open, so "past 7 days" doesn't change the query on every render.
  const [now] = React.useState(() => Date.now());
  const closedRange = React.useMemo(
    () => closedInterval(filters, now, timeZone),
    [filters, now, timeZone],
  );

  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "leads"],
    queryFn: () => crmApi.listPipelines("leads"),
  });
  const pipelines = React.useMemo(() => pipelinesQuery.data ?? [], [pipelinesQuery.data]);
  const pipeline =
    pipelines.find((p) => p.id === filters.pipeline) ?? pipelines.find((p) => p.isDefault) ?? pipelines[0];
  const pipelineId = pipeline?.id ?? "";

  const boardQs = boardParams(pipelineId, filters).toString();
  const boardKey = React.useMemo(() => ["lead-board", pipelineId, boardQs] as const, [pipelineId, boardQs]);
  const boardQuery = useQuery({
    queryKey: boardKey,
    queryFn: () => crmApi.getLeadBoard(new URLSearchParams(boardQs)),
    enabled: !!pipelineId,
    placeholderData: (prev) => prev,
  });

  const [pending, setPending] = React.useState<PendingMoves>({});
  const board = React.useMemo(
    () => (boardQuery.data ? applyPendingMoves(boardQuery.data, pending) : undefined),
    [boardQuery.data, pending],
  );
  const stages = React.useMemo(() => board?.stages ?? [], [board]);
  // Board Won column is filled by won_at (sales → Nurturing handoff), so totals match that column.
  const totals = React.useMemo(() => derivePipelineTotals(stages), [stages]);
  const counts = React.useMemo(() => statusCounts(totals), [totals]);
  const openStages = React.useMemo(() => stages.filter((s) => !s.isWon && !s.isLost), [stages]);
  const wonStage = stages.find((s) => s.isWon) ?? null;
  const lostStage = stages.find((s) => s.isLost) ?? null;
  const currency = primaryCurrency(board);

  const outcomeStage = filters.status === "won" ? wonStage : filters.status === "lost" ? lostStage : null;
  const closedOutcome = filters.status === "won" || filters.status === "lost" ? filters.status : null;
  // Won needs no stage row (query is by won_at); Lost still needs the Lost stage on this pipeline.
  const closedQs =
    closedOutcome === "won" || (closedOutcome === "lost" && outcomeStage)
      ? closedListParams(
          pipelineId,
          outcomeStage?.id ?? "",
          filters,
          closedPageSize,
          closedRange,
          closedOutcome,
        ).toString()
      : "";
  const closedQuery = useQuery({
    queryKey: ["leads", "pipeline-closed", closedQs],
    queryFn: () => crmApi.listLeads(new URLSearchParams(closedQs)),
    enabled: closedQs !== "",
    placeholderData: (prev) => prev,
  });

  const clearPending = React.useCallback(
    (leadId: string) =>
      setPending((prev) => {
        if (!(leadId in prev)) return prev;
        const next = { ...prev };
        delete next[leadId];
        return next;
      }),
    [],
  );

  const refresh = React.useCallback(
    (leadId?: string) => {
      void qc.invalidateQueries({ queryKey: ["lead-board"] });
      void qc.invalidateQueries({ queryKey: ["leads"] });
      void qc.invalidateQueries({ queryKey: ["lead-insights"] });
      if (leadId) void qc.invalidateQueries({ queryKey: ["lead", leadId] });
    },
    [qc],
  );

  /** Moves the card in the cache right away; the returned function puts it back. */
  const optimisticMove = React.useCallback(
    (vars: { leadId: string; to: { id: string }; lostReason?: string }) => {
      setPending((prev) => ({ ...prev, [vars.leadId]: vars.to.id }));
      void qc.cancelQueries({ queryKey: boardKey });
      const snapshot = qc.getQueryData<LeadBoard>(boardKey);
      if (snapshot) {
        qc.setQueryData<LeadBoard>(boardKey, moveCard(snapshot, vars.leadId, vars.to.id, { lostReason: vars.lostReason }));
      }
      return () => {
        clearPending(vars.leadId);
        if (snapshot) qc.setQueryData(boardKey, snapshot);
      };
    },
    [boardKey, clearPending, qc],
  );

  const settleMove = React.useCallback(
    (leadId: string) => {
      clearPending(leadId);
      refresh(leadId);
    },
    [clearPending, refresh],
  );

  const [loadingMore, setLoadingMore] = React.useState<string | null>(null);
  const loadMore = React.useCallback(
    async (stage: LeadBoardStage) => {
      setLoadingMore(stage.id);
      try {
        const p = new URLSearchParams(boardQs);
        p.set("stageId", stage.id);
        p.set("offset", String(stage.leads.length));
        const page = await crmApi.getLeadBoardStage(p);
        qc.setQueryData<LeadBoard>(boardKey, (prev) => (prev ? appendStagePage(prev, stage.id, page) : prev));
      } catch (err) {
        toast.error("Couldn't load more leads", {
          description: err instanceof Error && err.message ? err.message : undefined,
        });
      } finally {
        setLoadingMore(null);
      }
    },
    [boardKey, boardQs, qc],
  );

  return {
    pipelines,
    pipeline,
    pipelineId,
    noPipeline: pipelinesQuery.isSuccess && !pipelineId,
    board,
    stages,
    openStages,
    wonStage,
    lostStage,
    outcomeStage,
    now,
    closedRange,
    totals,
    counts,
    currency,
    isLoading: pipelinesQuery.isLoading || (!!pipelineId && !board && !boardQuery.isError),
    isError: pipelinesQuery.isError || (boardQuery.isError && !board),
    isFetching: boardQuery.isFetching,
    retry: () => {
      if (pipelinesQuery.isError) void pipelinesQuery.refetch();
      else void boardQuery.refetch();
    },
    closed: {
      rows: closedQuery.data?.data ?? [],
      total: closedQuery.data?.total ?? 0,
      isLoading: closedQs !== "" && closedQuery.isLoading,
      isError: closedQuery.isError,
      retry: () => void closedQuery.refetch(),
    },
    optimisticMove,
    settleMove,
    refresh,
    loadMore,
    loadingMore,
  };
}

export type PipelineData = ReturnType<typeof usePipelineLeads>;
