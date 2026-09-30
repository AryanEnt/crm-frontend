"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarPlus, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { BoardSkeleton } from "@/components/ui/skeleton";
import { StageRail, stageSlotFromPipeline, type StageSlot } from "@/components/ui/stage-rail";
import { StageRibbon, type RibbonSegment } from "@/components/ui/stage-ribbon";
import { Kpi } from "@/components/ui/kpi";
import { NextStepChip } from "@/components/ui/next-step-chip";
import { priorityFromString } from "@/lib/design-tokens";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { useAuth } from "@/features/auth/auth-provider";
import {
  crmApi,
  type Deal,
  type DealBoard,
  type PipelineStage,
  type StageMoveError,
} from "@/lib/api/crm";
import { ApiError } from "@/types/api";
import { cn } from "@/lib/utils";
import { ActivityQuickCreateDialog } from "@/features/activities/activity-quick-create";
import { DealQuickCreateDrawer } from "@/features/deals/deal-quick-create";
import {
  DealOutcomeButtons,
  LostReasonDialog,
  findOutcomeStage,
  type LostReasonState,
} from "@/features/deals/deal-outcome";
import { ScopeFilterControls, useScopeFilters } from "@/features/teams/scope-filters";

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

function stageFillPercent(deal: Deal, stage: PipelineStage): number {
  if (stage.isWon || stage.isLost) return 0;
  const days = deal.daysInStage ?? 0;
  if (stage.slaHours && stage.slaHours > 0) {
    return Math.min(100, Math.round((days * 24 * 100) / stage.slaHours));
  }
  return Math.min(100, days * 8);
}

function slotForStage(stage: PipelineStage, openStages: PipelineStage[]): StageSlot {
  const idx = openStages.findIndex((s) => s.id === stage.id);
  return stageSlotFromPipeline({
    position: idx >= 0 ? idx : 0,
    openStageCount: Math.max(openStages.length, 1),
    isWon: stage.isWon,
    isLost: stage.isLost,
  });
}

/** Optimistic board rearrange — move a deal into another stage column. */
function moveDealOnBoard(board: DealBoard, dealId: string, toStageId: string): DealBoard {
  let moved: Deal | undefined;
  const stripped = board.columns.map((col) => {
    const hit = col.deals.find((d) => d.id === dealId);
    if (!hit) return col;
    moved = hit;
    return { ...col, deals: col.deals.filter((d) => d.id !== dealId) };
  });
  if (!moved) return board;
  const stage = board.pipeline.stages.find((s) => s.id === toStageId);
  const next: Deal = {
    ...moved,
    stageId: toStageId,
    stageName: stage?.name ?? moved.stageName,
    status: stage?.isWon ? "won" : stage?.isLost ? "lost" : "open",
    daysInStage: 0,
    stageEnteredAt: new Date().toISOString(),
  };
  return {
    ...board,
    columns: stripped.map((col) =>
      col.stage.id === toStageId ? { ...col, deals: [next, ...col.deals] } : col,
    ),
  };
}

/**
 * Rebuilds columns so every deal appears in exactly one stage: its in-flight move
 * target if one is pending, otherwise its own stageId. A background refetch that
 * lands mid-move would otherwise redraw the deal in its old column as well.
 */
function placeDealsOnce(columns: DealBoard["columns"], pending: Record<string, string>): DealBoard["columns"] {
  const stages = new Map(columns.map((col) => [col.stage.id, col.stage]));
  const latest = new Map<string, Deal>();
  for (const col of columns) {
    for (const deal of col.deals) {
      const seen = latest.get(deal.id);
      if (!seen || new Date(deal.stageEnteredAt).getTime() > new Date(seen.stageEnteredAt).getTime()) {
        latest.set(deal.id, { ...deal, stageId: deal.stageId ?? col.stage.id });
      }
    }
  }
  const byStage = new Map<string, Deal[]>();
  for (const deal of latest.values()) {
    const targetId = pending[deal.id] ?? deal.stageId;
    const stage = targetId ? stages.get(targetId) : undefined;
    if (!stage || !targetId) continue;
    const placed =
      targetId === deal.stageId
        ? deal
        : {
            ...deal,
            stageId: targetId,
            stageName: stage.name,
            status: stage.isWon ? "won" : stage.isLost ? "lost" : "open",
          };
    byStage.set(targetId, [...(byStage.get(targetId) ?? []), placed]);
  }
  return columns.map((col) => ({
    ...col,
    deals: (byStage.get(col.stage.id) ?? []).sort((a, b) => {
      const ai = col.deals.findIndex((d) => d.id === a.id);
      const bi = col.deals.findIndex((d) => d.id === b.id);
      return (ai < 0 ? -1 : ai) - (bi < 0 ? -1 : bi);
    }),
  }));
}

export function PipelineBoardView({
  viewToggle,
  pipelineId: pipelineIdProp,
  onPipelineIdChange,
}: {
  viewToggle?: React.ReactNode;
  pipelineId?: string;
  onPipelineIdChange?: (id: string) => void;
}) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [localPipelineId, setLocalPipelineId] = React.useState<string>("");
  const setPipelineId = onPipelineIdChange ?? setLocalPipelineId;
  const [activeDeal, setActiveDeal] = React.useState<Deal | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [activityDeal, setActivityDeal] = React.useState<Deal | null>(null);
  const [lostPending, setLostPending] = React.useState<LostReasonState>(null);
  const [hideClosed, setHideClosed] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [pendingMoves, setPendingMoves] = React.useState<Record<string, string>>({});
  const [closingFilter, setClosingFilter] = React.useState("all");
  const [noNextOnly, setNoNextOnly] = React.useState(false);
  const [wonPulseId, setWonPulseId] = React.useState<string | null>(null);
  const [stageFlashId, setStageFlashId] = React.useState<string | null>(null);
  const [announce, setAnnounce] = React.useState("");
  const scopeFilters = useScopeFilters("deals:view", { team: false });
  const ownerId = scopeFilters.ownerId;
  const [blockers, setBlockers] = React.useState<{
    dealId: string;
    stageId: string;
    details: StageMoveError;
    lostReason?: string;
  } | null>(null);

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

  const boardKey = [
    "deal-board",
    activePipelineId,
    ownerId,
  ] as const;

  const boardQuery = useQuery({
    queryKey: boardKey,
    queryFn: () =>
      crmApi.getDealBoard(activePipelineId, ownerId !== "all" ? ownerId : undefined),
    enabled: !!activePipelineId,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const moveMutation = useMutation({
    mutationFn: ({
      dealId,
      stageId,
      force,
      lostReason,
    }: {
      dealId: string;
      stageId: string;
      force?: boolean;
      lostReason?: string;
      skipOptimistic?: boolean;
    }) =>
      crmApi.moveDeal(dealId, {
        stageId,
        pipelineId: activePipelineId,
        force,
        lostReason,
      }),
    onMutate: async (vars) => {
      if (vars.skipOptimistic) return { previous: undefined };
      setPendingMoves((prev) => ({ ...prev, [vars.dealId]: vars.stageId }));
      await qc.cancelQueries({ queryKey: boardKey });
      const previous = qc.getQueryData<DealBoard>(boardKey);
      if (previous) {
        qc.setQueryData<DealBoard>(boardKey, moveDealOnBoard(previous, vars.dealId, vars.stageId));
      }
      return { previous };
    },
    onSuccess: (_d, vars) => {
      setBlockers(null);
      setLostPending(null);
      setStageFlashId(vars.dealId);
      window.setTimeout(() => setStageFlashId(null), 360);
      const target = boardQuery.data?.pipeline?.stages.find((s) => s.id === vars.stageId)
        ?? qc.getQueryData<DealBoard>(boardKey)?.pipeline.stages.find((s) => s.id === vars.stageId);
      const dealTitle =
        qc.getQueryData<DealBoard>(boardKey)?.columns
          .flatMap((c) => c.deals)
          .find((d) => d.id === vars.dealId)?.title ?? "Deal";
      if (target?.isWon) {
        setWonPulseId(vars.dealId);
        window.setTimeout(() => setWonPulseId(null), 900);
        toast.success(`Won: ${dealTitle}. Nice work.`);
        setAnnounce(`${dealTitle} marked won`);
      } else {
        toast.success(vars.lostReason ? "Deal marked lost" : "Deal stage updated");
        setAnnounce(
          vars.lostReason
            ? `${dealTitle} marked lost`
            : `${dealTitle} moved to ${target?.name ?? "new stage"}`,
        );
      }
    },
    onError: (err, vars, ctx) => {
      clearPendingMove(vars.dealId);
      if (ctx?.previous) {
        qc.setQueryData(boardKey, ctx.previous);
      }
      if (err instanceof ApiError && err.status === 400 && err.details) {
        setBlockers({
          dealId: vars.dealId,
          stageId: vars.stageId,
          details: err.details as StageMoveError,
          lostReason: vars.lostReason,
        });
        toast.warning("Stage move blocked — review requirements");
        setAnnounce("Stage move blocked. Review requirements.");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Couldn't move the deal. Try again.");
      setAnnounce("Deal stage move failed and was reverted.");
    },
    onSettled: async (_data, _err, vars) => {
      await qc.invalidateQueries({ queryKey: boardKey });
      clearPendingMove(vars.dealId);
    },
  });

  function clearPendingMove(dealId: string) {
    setPendingMoves((prev) => {
      if (!(dealId in prev)) return prev;
      const next = { ...prev };
      delete next[dealId];
      return next;
    });
  }

  const pipeline = boardQuery.data?.pipeline;
  const wonStage = findOutcomeStage(pipeline, "won");
  const lostStage = findOutcomeStage(pipeline, "lost");
  const openStages = React.useMemo(
    () =>
      (pipeline?.stages ?? []).filter((s) => s.isActive && !s.isWon && !s.isLost),
    [pipeline?.stages],
  );

  const requestMove = (deal: Deal, stage: PipelineStage, force?: boolean) => {
    if (deal.stageId === stage.id) return;
    if (stage.isLost) {
      setLostPending({
        dealId: deal.id,
        stageId: stage.id,
        stageName: stage.name,
        force,
      });
      return;
    }
    moveMutation.mutate({ dealId: deal.id, stageId: stage.id, force });
  };

  const onDragStart = (event: DragStartEvent) => {
    const deal = event.active.data.current?.deal as Deal | undefined;
    setActiveDeal(deal ?? null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveDeal(null);
    const deal = event.active.data.current?.deal as Deal | undefined;
    const overId = event.over?.id?.toString();
    if (!deal || !overId || !can("deals:edit")) return;
    const targetStageId = overId.startsWith("stage:") ? overId.slice(6) : overId;
    const stage = pipeline?.stages.find((s) => s.id === targetStageId);
    if (!stage || deal.stageId === targetStageId) return;
    requestMove(deal, stage);
  };

  const filteredColumns = React.useMemo(() => {
    const cols = placeDealsOnce(boardQuery.data?.columns ?? [], pendingMoves);
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return cols
      .filter((col) => {
        if (hideClosed && (col.stage.isWon || col.stage.isLost)) return false;
        return true;
      })
      .map((col) => {
        const deals = col.deals.filter((d) => {
          if (ownerId !== "all" && d.ownerUserId !== ownerId) {
            return false;
          }
          if (statusFilter !== "all" && d.status !== statusFilter) return false;
          if (noNextOnly && d.nextActivityAt) return false;
          if (closingFilter === "this_month") {
            if (!d.expectedCloseAt) return false;
            const dt = new Date(d.expectedCloseAt);
            if (dt.getMonth() !== month || dt.getFullYear() !== year) return false;
          }
          if (closingFilter === "overdue") {
            if (!d.expectedCloseAt || d.status !== "open") return false;
            if (new Date(d.expectedCloseAt) >= new Date(now.toDateString())) return false;
          }
          return true;
        });
        return { ...col, deals };
      });
  }, [
    boardQuery.data?.columns,
    pendingMoves,
    hideClosed,
    ownerId,
    statusFilter,
    noNextOnly,
    closingFilter,
  ]);

  const boardStats = React.useMemo(() => {
    const deals = filteredColumns.flatMap((c) => c.deals);
    const open = deals.filter((d) => d.status === "open");
    const value = open.reduce((sum, d) => sum + (d.value ?? 0), 0);
    const weighted = open.reduce(
      (sum, d) => sum + (d.value ?? 0) * ((d.probability ?? 0) / 100),
      0,
    );
    const noNext = open.filter((d) => !d.nextActivityAt).length;
    return { count: open.length, value, weighted, noNext };
  }, [filteredColumns]);

  const ribbon: RibbonSegment[] = filteredColumns
    .filter((col) => !col.stage.isWon && !col.stage.isLost)
    .map((col) => ({
      id: col.stage.id,
      label: col.stage.name,
      value: col.deals.reduce((sum, d) => sum + (d.status === "open" ? d.value ?? 0 : 0), 0),
      slot: slotForStage(col.stage, openStages),
    }));

  if (pipelinesQuery.isError) {
    return <ErrorState onRetry={() => void pipelinesQuery.refetch()} />;
  }

  return (
    <div className="space-y-3">
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-live="polite" aria-atomic="true">
        {announce}
      </div>
      <PageHeader
        display
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Deals" }]}
        title="Deals"
        description="Drag or keyboard-move deals between stages. Every open deal should have a next step."
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
        onClear={() => {
          setStatusFilter("all");
          setClosingFilter("all");
          setNoNextOnly(false);
          setHideClosed(false);
          scopeFilters.reset();
        }}
      >
        <ScopeFilterControls filters={scopeFilters} />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="won">Won</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
        <Select value={closingFilter} onValueChange={setClosingFilter}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Closing" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any close date</SelectItem>
            <SelectItem value="this_month">Closing this month</SelectItem>
            <SelectItem value="overdue">Overdue close</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={noNextOnly ? "secondary" : "outline"}
          onClick={() => setNoNextOnly((v) => !v)}
        >
          No next activity
        </Button>
        <Button
          size="sm"
          variant={hideClosed ? "secondary" : "outline"}
          onClick={() => setHideClosed((v) => !v)}
        >
          Hide closed
        </Button>
      </FilterBar>

      <section aria-label="Board summary" className="space-y-3 pb-1">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
          <Kpi label="Pipeline value" value={boardStats.value} format={(n) => formatMoney(n)} />
          <Kpi label="Weighted forecast" value={boardStats.weighted} format={(n) => formatMoney(n)} />
          <Kpi label="Open deals" value={boardStats.count} />
          {boardStats.count > 0 ? (
            boardStats.noNext > 0 || noNextOnly ? (
              <button
                type="button"
                aria-pressed={noNextOnly}
                onClick={() => setNoNextOnly((v) => !v)}
                className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-control bg-warning-soft px-3 text-body text-warning transition-[filter] duration-150 hover:brightness-[0.97]"
              >
                {noNextOnly ? (
                  "Showing deals with no next step · Show all"
                ) : (
                  <>
                    <strong className="font-semibold tabular-nums">{boardStats.noNext}</strong>
                    {boardStats.noNext === 1 ? "deal has" : "deals have"} no next step · Review
                  </>
                )}
              </button>
            ) : (
              <p className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-control bg-success-soft px-3 text-body text-success">
                <Check className="size-3.5" aria-hidden />
                Every open deal has a next step
              </p>
            )
          ) : null}
        </div>
        {ribbon.length > 0 ? (
          <StageRibbon
            segments={ribbon}
            label="Open value by stage"
            formatValue={(v) => formatMoney(v)}
          />
        ) : null}
      </section>

      {!activePipelineId || boardQuery.isLoading ? (
        <BoardSkeleton columns={4} />
      ) : boardQuery.isError || !boardQuery.data ? (
        <ErrorState onRetry={() => void boardQuery.refetch()} />
      ) : filteredColumns.every((c) => c.deals.length === 0) ? (
        <EmptyState
          title="No deals match this view"
          description="Clear a filter, or add a deal to get the pipeline moving."
          actionLabel={can("deals:create") ? "New deal" : undefined}
          onAction={can("deals:create") ? () => setCreateOpen(true) : undefined}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-2">
            {filteredColumns.map((col) => (
              <StageColumn
                key={col.stage.id}
                stage={col.stage}
                slot={slotForStage(col.stage, openStages)}
                share={
                  col.stage.isWon || col.stage.isLost || boardStats.value <= 0
                    ? null
                    : Math.round(
                        ((ribbon.find((r) => r.id === col.stage.id)?.value ?? 0) / boardStats.value) * 100,
                      )
                }
                deals={col.deals}
                canEdit={can("deals:edit")}
                canCreateActivity={can("activities:create")}
                wonStage={wonStage}
                lostStage={lostStage}
                wonPulseId={wonPulseId}
                stageFlashId={stageFlashId}
                onWon={(deal) => wonStage && requestMove(deal, wonStage)}
                onLost={(deal) => lostStage && requestMove(deal, lostStage)}
                onAddActivity={setActivityDeal}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeDeal ? (
              <DealCard
                deal={activeDeal}
                stage={
                  pipeline?.stages.find((s) => s.id === activeDeal.stageId) ??
                  openStages[0]
                }
                slot={
                  pipeline?.stages.find((s) => s.id === activeDeal.stageId)
                    ? slotForStage(
                        pipeline.stages.find((s) => s.id === activeDeal.stageId)!,
                        openStages,
                      )
                    : "1"
                }
                overlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <DealQuickCreateDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultPipelineId={activePipelineId}
        onCreated={() => {
          void qc.invalidateQueries({ queryKey: ["deal-board", activePipelineId] });
          void qc.invalidateQueries({ queryKey: ["deals"] });
        }}
      />

      <ActivityQuickCreateDialog
        open={!!activityDeal}
        onOpenChange={(o) => !o && setActivityDeal(null)}
        context={
          activityDeal
            ? { dealId: activityDeal.id, customerId: activityDeal.customerId }
            : undefined
        }
        onCreated={() => {
          setActivityDeal(null);
          void qc.invalidateQueries({ queryKey: ["deal-board", activePipelineId] });
        }}
      />

      <LostReasonDialog
        pending={lostPending}
        loading={moveMutation.isPending}
        onCancel={() => setLostPending(null)}
        onConfirm={(reason) => {
          if (!lostPending) return;
          moveMutation.mutate({
            dealId: lostPending.dealId,
            stageId: lostPending.stageId,
            force: lostPending.force,
            lostReason: reason,
          });
        }}
      />

      <Modal open={!!blockers} onOpenChange={(o) => !o && setBlockers(null)}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Stage requirements not met</ModalTitle>
            <ModalDescription>
              Complete the missing items before moving into{" "}
              {blockers?.details.stageName ?? "this stage"}, or confirm to proceed anyway.
            </ModalDescription>
          </ModalHeader>
          <ul className="space-y-2 text-sm">
            {(blockers?.details.missingFields ?? []).map((f) => (
              <li key={`f-${f}`} className="text-foreground-muted">
                Required field: <span className="font-medium text-foreground">{f}</span>
              </li>
            ))}
            {(blockers?.details.missingActivities ?? []).map((a) => (
              <li key={`a-${a}`} className="text-foreground-muted">
                Required activity: <span className="font-medium text-foreground">{a}</span>
              </li>
            ))}
            {(blockers?.details.missingDocuments ?? []).map((d) => (
              <li key={`d-${d}`} className="text-foreground-muted">
                Required document: <span className="font-medium text-foreground">{d}</span>
              </li>
            ))}
          </ul>
          <ModalFooter>
            <Button variant="outline" onClick={() => setBlockers(null)}>
              Cancel
            </Button>
            <Button
              loading={moveMutation.isPending}
              onClick={() => {
                if (!blockers) return;
                moveMutation.mutate({
                  dealId: blockers.dealId,
                  stageId: blockers.stageId,
                  force: true,
                  lostReason: blockers.lostReason,
                });
              }}
            >
              Move anyway
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

const SLOT_BG: Record<StageSlot, string> = {
  "1": "bg-stage-1",
  "2": "bg-stage-2",
  "3": "bg-stage-3",
  "4": "bg-stage-4",
  won: "bg-stage-won",
  lost: "bg-stage-lost",
};

function StageColumn({
  stage,
  slot,
  share,
  deals,
  canEdit,
  canCreateActivity,
  wonStage,
  lostStage,
  wonPulseId,
  stageFlashId,
  onWon,
  onLost,
  onAddActivity,
}: {
  stage: PipelineStage;
  slot: StageSlot;
  /** Share of open pipeline value (0–100); null for won/lost columns. */
  share: number | null;
  deals: Deal[];
  canEdit: boolean;
  canCreateActivity: boolean;
  wonStage: PipelineStage | null;
  lostStage: PipelineStage | null;
  wonPulseId: string | null;
  stageFlashId: string | null;
  onWon: (deal: Deal) => void;
  onLost: (deal: Deal) => void;
  onAddActivity: (deal: Deal) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${stage.id}` });
  const total = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const weighted = deals.reduce(
    (sum, d) => sum + (d.value ?? 0) * ((d.probability ?? 0) / 100),
    0,
  );
  const muted = stage.isWon || stage.isLost;
  const emptyCopy = stage.isWon
    ? "Wins land here."
    : stage.isLost
      ? "Nothing lost. Keep it that way."
      : "Drag a deal here.";

  return (
    <section
      ref={setNodeRef}
      aria-label={`${stage.name}: ${deals.length} deals, ${formatMoney(total)}`}
      className={cn(
        "relative flex w-[264px] shrink-0 flex-col overflow-hidden rounded-card bg-surface-muted/60 transition-colors duration-150",
        isOver && "stage-column--drop-target ring-1 ring-brand/40",
      )}
    >
      <div
        aria-hidden
        title={share != null ? `${share}% of open pipeline value` : undefined}
        className={cn("relative h-[3px] w-full", share == null && SLOT_BG[slot])}
      >
        {share != null ? (
          <>
            <span className={cn("absolute inset-0 opacity-20", SLOT_BG[slot])} />
            <span
              className={cn("stage-ribbon__seg absolute inset-y-0 left-0", SLOT_BG[slot])}
              style={{ width: `${Math.max(share, deals.length > 0 ? 3 : 0)}%` }}
            />
          </>
        ) : null}
      </div>
      <header className="px-3 pb-2 pt-2.5">
        <div className="flex items-center gap-2">
          <h3 className="text-section truncate">{stage.name}</h3>
          <span className="ml-auto text-meta tabular-nums">{deals.length}</span>
        </div>
        <p className={cn("mt-0.5 text-numeral-sm", muted && "text-ink-secondary")}>
          {formatMoney(total)}
          {!muted ? (
            <span className="ml-1.5 text-meta font-normal">
              {formatMoney(weighted)} weighted
              {share != null ? ` · ${share}%` : ""}
            </span>
          ) : null}
        </p>
      </header>
      <div className="flex max-h-[calc(100vh-300px)] flex-col gap-1.5 overflow-y-auto crm-scroll px-1.5 pb-1.5">
        {deals.length === 0 ? (
          <p className="rounded-md border border-dashed border-line px-2 py-6 text-center text-meta">
            {emptyCopy}
          </p>
        ) : (
          deals.map((deal) => (
            <DraggableDeal
              key={deal.id}
              deal={deal}
              stage={stage}
              slot={slot}
              canEdit={canEdit}
              canCreateActivity={canCreateActivity}
              wonStage={wonStage}
              lostStage={lostStage}
              wonPulse={wonPulseId === deal.id}
              stageFlash={stageFlashId === deal.id}
              onWon={onWon}
              onLost={onLost}
              onAddActivity={onAddActivity}
            />
          ))
        )}
      </div>
    </section>
  );
}

function DraggableDeal({
  deal,
  stage,
  slot,
  canEdit,
  canCreateActivity,
  wonStage,
  lostStage,
  wonPulse,
  stageFlash,
  onWon,
  onLost,
  onAddActivity,
}: {
  deal: Deal;
  stage: PipelineStage;
  slot: StageSlot;
  canEdit: boolean;
  canCreateActivity: boolean;
  wonStage: PipelineStage | null;
  lostStage: PipelineStage | null;
  wonPulse: boolean;
  stageFlash: boolean;
  onWon: (deal: Deal) => void;
  onLost: (deal: Deal) => void;
  onAddActivity: (deal: Deal) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { deal },
    disabled: !canEdit,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="group/card rounded-md"
      role="button"
      tabIndex={canEdit ? 0 : -1}
      aria-roledescription="draggable deal"
      aria-label={`${deal.title}, ${stage.name}. Use space or enter to pick up, arrow keys to move.`}
    >
      <DealCard
        deal={deal}
        stage={stage}
        slot={slot}
        canEdit={canEdit}
        canCreateActivity={canCreateActivity}
        wonStage={wonStage}
        lostStage={lostStage}
        wonPulse={wonPulse}
        stageFlash={stageFlash}
        onWon={() => onWon(deal)}
        onLost={() => onLost(deal)}
        onAddActivity={() => onAddActivity(deal)}
      />
    </div>
  );
}

function DealCard({
  deal,
  stage,
  slot,
  overlay,
  canEdit,
  canCreateActivity,
  wonStage,
  lostStage,
  wonPulse,
  stageFlash,
  onWon,
  onLost,
  onAddActivity,
}: {
  deal: Deal;
  stage?: PipelineStage;
  slot: StageSlot;
  overlay?: boolean;
  canEdit?: boolean;
  canCreateActivity?: boolean;
  wonStage?: PipelineStage | null;
  lostStage?: PipelineStage | null;
  wonPulse?: boolean;
  stageFlash?: boolean;
  onWon?: () => void;
  onLost?: () => void;
  onAddActivity?: () => void;
}) {
  const fill = stage ? stageFillPercent(deal, stage) : 0;
  const priority = priorityFromString(deal.priority);

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-md border border-line bg-surface py-2 pl-3 pr-2.5 transition-[border-color] duration-150 group-hover/card:border-line-strong",
        overlay && "deal-card--drag-overlay",
        stageFlash && "deal-card--stage-changed",
        wonPulse && "deal-card--won",
      )}
    >
      <StageRail slot={slot} fillPercent={fill} wonPulse={wonPulse} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/deals/${deal.id}`}
            className="flex items-center gap-1 truncate text-body font-medium text-ink hover:text-brand"
            onClick={(e) => e.stopPropagation()}
          >
            {deal.status === "won" ? (
              <Check
                aria-label="Won"
                className={cn("size-3.5 shrink-0 text-stage-won-ink", wonPulse && "won-check--land")}
                strokeWidth={2.5}
              />
            ) : null}
            <span className="truncate">{deal.title}</span>
          </Link>
          <p className="truncate text-meta">{deal.customerName}</p>
        </div>
        <span className="shrink-0 text-numeral-sm">{formatMoney(deal.value, deal.currency)}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-meta">
        {deal.status === "open" ? <NextStepChip at={deal.nextActivityAt} /> : null}
        <span className="tabular-nums">{deal.daysInStage ?? 0}d in stage</span>
        <span className="inline-flex items-center gap-1 capitalize">
          {priority === "high" || priority === "urgent" ? (
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                priority === "urgent" ? "bg-priority-urgent" : "bg-priority-high",
              )}
            />
          ) : null}
          {priority}
        </span>
      </div>

      {deal.status === "lost" && deal.lostReason ? (
        <p className="mt-1.5 text-caption text-stage-lost-ink">Lost: {deal.lostReason}</p>
      ) : null}
      {deal.attention && deal.attention !== "no_next_activity" ? (
        <p className="mt-1 text-caption text-warning">
          {attentionLabel[deal.attention] ?? deal.attention}
        </p>
      ) : null}

      {!overlay ? (
        <div
          className="mt-2 flex flex-wrap items-center gap-1 transition-opacity duration-150 pointer-fine:opacity-0 pointer-fine:group-hover/card:opacity-100 pointer-fine:group-focus-within/card:opacity-100"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {canCreateActivity && deal.status === "open" ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={(e) => {
                e.stopPropagation();
                onAddActivity?.();
              }}
            >
              <CalendarPlus className="size-3.5" />
              Activity
            </Button>
          ) : null}
          {onWon && onLost ? (
            <DealOutcomeButtons
              status={deal.status}
              canEdit={Boolean(canEdit)}
              wonStage={wonStage ?? null}
              lostStage={lostStage ?? null}
              onWon={onWon}
              onLost={onLost}
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
