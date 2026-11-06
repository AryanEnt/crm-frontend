"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  appendStagePage,
  applyPendingMoves,
  moveCard,
  replaceStagePage,
  type PendingMoves,
} from "@/features/leads/lead-board-state";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi, type LeadBoard, type LeadBoardStage } from "@/lib/api/crm";
import { closedInterval } from "./closed-range";
import {
  boardParams,
  closedListParams,
  isClosedStatus,
  openListParams,
  type BoardSortKey,
  type PipelineFilters,
  type SortOrder,
} from "./pipeline-filters";
import { derivePipelineTotals, statusCounts } from "./pipeline-totals";

export type StageBoardSort = { sort: BoardSortKey; order: SortOrder };

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

  const outcomeStage =
    filters.status === "won" || filters.status === "complete"
      ? wonStage
      : filters.status === "lost"
        ? lostStage
        : null;
  const closedOutcome =
    filters.status === "won" || filters.status === "lost" || filters.status === "complete" ? filters.status : null;
  // Won needs no stage row (query is by won_at). Complete and Lost list the stage on this pipeline.
  const closedQs =
    closedOutcome === "won" || ((closedOutcome === "lost" || closedOutcome === "complete") && outcomeStage)
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

  const openTable =
    !!pipelineId && filters.view === "table" && !isClosedStatus(filters.status);
  const openQs = openTable ? openListParams(pipelineId, filters, closedPageSize).toString() : "";
  const openQuery = useQuery({
    queryKey: ["leads", "pipeline-open", openQs],
    queryFn: () => crmApi.listLeads(new URLSearchParams(openQs)),
    enabled: openQs !== "",
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
  /** Per-stage sort overrides; when absent, the column uses the global board sort. */
  const [stageSorts, setStageSorts] = React.useState<Record<string, StageBoardSort>>({});
  const [sortingStage, setSortingStage] = React.useState<string | null>(null);

  // Global sort changes clear funnel-wise overrides so columns stay in sync.
  React.useEffect(() => {
    setStageSorts({});
  }, [filters.boardSort, filters.boardOrder, pipelineId]);

  const stageSortParams = React.useCallback(
    (stageId: string) => {
      const override = stageSorts[stageId];
      const p = new URLSearchParams(boardQs);
      if (override) {
        p.set("sort", override.sort);
        p.set("order", override.order);
      }
      return p;
    },
    [boardQs, stageSorts],
  );

  const loadMore = React.useCallback(
    async (stage: LeadBoardStage) => {
      setLoadingMore(stage.id);
      try {
        const p = stageSortParams(stage.id);
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
    [boardKey, qc, stageSortParams],
  );

  const setStageSort = React.useCallback(
    async (stageId: string, next: StageBoardSort | null) => {
      const matchesGlobal =
        !next || (next.sort === filters.boardSort && next.order === filters.boardOrder);
      setStageSorts((prev) => {
        if (matchesGlobal) {
          if (!(stageId in prev)) return prev;
          const copy = { ...prev };
          delete copy[stageId];
          return copy;
        }
        return { ...prev, [stageId]: next! };
      });
      setSortingStage(stageId);
      try {
        const p = new URLSearchParams(boardQs);
        p.set("stageId", stageId);
        p.set("offset", "0");
        if (!matchesGlobal && next) {
          p.set("sort", next.sort);
          p.set("order", next.order);
        }
        const page = await crmApi.getLeadBoardStage(p);
        qc.setQueryData<LeadBoard>(boardKey, (prev) => (prev ? replaceStagePage(prev, stageId, page) : prev));
      } catch (err) {
        toast.error("Couldn't re-sort this stage", {
          description: err instanceof Error && err.message ? err.message : undefined,
        });
      } finally {
        setSortingStage(null);
      }
    },
    [boardKey, boardQs, filters.boardOrder, filters.boardSort, qc],
  );

  const stageSortFor = React.useCallback(
    (stageId: string): StageBoardSort =>
      stageSorts[stageId] ?? { sort: filters.boardSort, order: filters.boardOrder },
    [filters.boardOrder, filters.boardSort, stageSorts],
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
    openList: {
      rows: openQuery.data?.data ?? [],
      total: openQuery.data?.total ?? 0,
      isLoading: openQs !== "" && openQuery.isLoading,
      isError: openQuery.isError,
      retry: () => void openQuery.refetch(),
    },
    optimisticMove,
    settleMove,
    refresh,
    loadMore,
    loadingMore,
    stageSortFor,
    setStageSort,
    sortingStage,
    stageHasOverride: (stageId: string) => stageId in stageSorts,
  };
}

export type PipelineData = ReturnType<typeof usePipelineLeads>;
