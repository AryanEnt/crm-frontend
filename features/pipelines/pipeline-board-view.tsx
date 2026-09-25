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
import { CalendarPlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { BoardSkeleton } from "@/components/ui/skeleton";
import { StageRail, stageSlotFromPipeline, type StageSlot } from "@/components/ui/stage-rail";
import { priorityFromString, priorityBadgeClass } from "@/lib/design-tokens";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  DealOutcomeButtons,
  LostReasonDialog,
  findOutcomeStage,
  type LostReasonState,
} from "@/features/deals/deal-outcome";
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

function formatWhen(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString();
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

export function PipelineBoardView({
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
  const [localPipelineId, setLocalPipelineId] = React.useState<string>("");
  const setPipelineId = onPipelineIdChange ?? setLocalPipelineId;
  const [activeDeal, setActiveDeal] = React.useState<Deal | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [activityDeal, setActivityDeal] = React.useState<Deal | null>(null);
  const [lostPending, setLostPending] = React.useState<LostReasonState>(null);
  const [hideClosed, setHideClosed] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState("open");
  const [closingFilter, setClosingFilter] = React.useState("all");
  const [noNextOnly, setNoNextOnly] = React.useState(false);
  const [wonPulseId, setWonPulseId] = React.useState<string | null>(null);
  const [stageFlashId, setStageFlashId] = React.useState<string | null>(null);
  const [announce, setAnnounce] = React.useState("");
  const isTeamLead = user?.roleCode === "sales_manager";
  const { salesExecutiveId, setSalesExecutiveId } = useTeamMemberFilter(isTeamLead);
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
    isTeamLead ? salesExecutiveId : "self",
  ] as const;

  const boardQuery = useQuery({
    queryKey: boardKey,
    queryFn: () =>
      crmApi.getDealBoard(
        activePipelineId,
        isTeamLead && salesExecutiveId !== "all" ? salesExecutiveId : undefined,
      ),
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
        window.setTimeout(() => setWonPulseId(null), 500);
        toast.success("Deal marked won");
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
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: boardKey });
    },
  });

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
    const cols = boardQuery.data?.columns ?? [];
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
          if (isTeamLead && salesExecutiveId !== "all" && d.ownerUserId !== salesExecutiveId) {
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
    hideClosed,
    isTeamLead,
    salesExecutiveId,
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

  if (pipelinesQuery.isError) {
    return <ErrorState onRetry={() => void pipelinesQuery.refetch()} />;
  }

  return (
    <div className="space-y-3">
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-live="polite" aria-atomic="true">
        {announce}
      </div>
      <PageHeader
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Deals" }]}
        title="Deals"
        description="Pipeline workbench — drag or keyboard-move stages, mark won or lost, and keep a next activity on every open deal."
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
          setStatusFilter("open");
          setClosingFilter("all");
          setNoNextOnly(false);
          setHideClosed(false);
          setSalesExecutiveId("all");
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

      <div className="grid gap-2 rounded-[var(--radius-lg)] border border-border bg-surface px-3 py-2.5 sm:grid-cols-4">
        <div>
          <p className="text-label">Open deals</p>
          <p className="text-board-total tabular-nums">{boardStats.count}</p>
        </div>
        <div>
          <p className="text-label">Pipeline value</p>
          <p className="text-board-total tabular-nums">{formatMoney(boardStats.value)}</p>
        </div>
        <div>
          <p className="text-label">Weighted forecast</p>
          <p className="text-board-total tabular-nums">{formatMoney(boardStats.weighted)}</p>
        </div>
        <div>
          <p className="text-label">Missing next activity</p>
          <p
            className={cn(
              "text-board-total tabular-nums",
              boardStats.noNext > 0 && "text-health-warn",
            )}
          >
            {boardStats.noNext}
          </p>
        </div>
      </div>

      {!activePipelineId || boardQuery.isLoading ? (
        <BoardSkeleton columns={4} />
      ) : boardQuery.isError || !boardQuery.data ? (
        <ErrorState onRetry={() => void boardQuery.refetch()} />
      ) : filteredColumns.every((c) => c.deals.length === 0) ? (
        <EmptyState
          title="No deals in this view"
          description="Adjust filters or create a deal to start filling the pipeline."
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

      <CreateDealDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        pipelineId={activePipelineId}
        firstStageId={boardQuery.data?.columns[0]?.stage.id}
        onCreated={() => void qc.invalidateQueries({ queryKey: ["deal-board", activePipelineId] })}
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

function StageColumn({
  stage,
  slot,
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

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "relative flex w-[260px] shrink-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-canvas",
        muted && "opacity-90",
        stage.isWon && "border-stage-won/25",
        stage.isLost && "border-stage-lost/25",
        isOver && "ring-2 ring-brand/35 stage-column--drop-target",
      )}
    >
      <StageRail slot={slot} />
      <header className="border-b border-border bg-surface px-3 py-2 pl-3.5">
        <div className="flex items-center gap-2">
          <h3 className="text-section truncate">{stage.name}</h3>
          <span className="ml-auto text-meta tabular-nums">{deals.length}</span>
        </div>
        <p className="mt-0.5 text-board-total tabular-nums text-ink-secondary">
          {formatMoney(total)}
          {!muted ? (
            <span className="font-normal text-meta">
              {" "}
              · {formatMoney(weighted)} weighted
            </span>
          ) : null}
        </p>
      </header>
      <div className="flex max-h-[calc(100vh-280px)] flex-col gap-1.5 overflow-y-auto crm-scroll p-1.5 pl-2">
        {deals.length === 0 ? (
          <p className="px-2 py-6 text-center text-meta">No deals</p>
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
  const missingNext = deal.status === "open" && !deal.nextActivityAt;
  const fill = stage ? stageFillPercent(deal, stage) : 0;
  const priority = priorityFromString(deal.priority);

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface pl-2.5 pr-2 py-2",
        overlay && "deal-card--drag-overlay shadow-md ring-1 ring-border",
        stageFlash && "deal-card--stage-changed",
        missingNext && "border-health-warn/40",
        deal.status === "won" && "border-stage-won/35",
        deal.status === "lost" && "border-stage-lost/30",
      )}
    >
      <StageRail slot={slot} fillPercent={fill} wonPulse={wonPulse} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/deals/${deal.id}`}
            className="block truncate text-data text-foreground hover:text-brand"
            onClick={(e) => e.stopPropagation()}
          >
            {deal.title}
          </Link>
          <p className="truncate text-meta">{deal.customerName}</p>
        </div>
        <span className={cn("shrink-0 capitalize", priorityBadgeClass[priority], "rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[10px] font-medium")}>
          {deal.priority}
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-meta">
        <span className="tabular-nums text-data text-ink">
          {formatMoney(deal.value, deal.currency)}
        </span>
        <span className="tabular-nums">
          {deal.daysInStage ?? 0}d in stage
        </span>
        <span className={cn(missingNext && "font-medium text-health-warn")}>
          {missingNext ? "No next activity" : `Next ${formatWhen(deal.nextActivityAt)}`}
        </span>
      </div>

      {deal.status === "lost" && deal.lostReason ? (
        <p className="mt-1.5 text-[11px] text-stage-lost">Lost: {deal.lostReason}</p>
      ) : null}
      {deal.attention && deal.attention !== "no_next_activity" ? (
        <p className="mt-1 text-[11px] text-health-warn">
          {attentionLabel[deal.attention] ?? deal.attention}
        </p>
      ) : null}

      {!overlay ? (
        <div
          className="mt-2 flex flex-wrap items-center gap-1"
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

function CreateDealDialog({
  open,
  onOpenChange,
  pipelineId,
  firstStageId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipelineId: string;
  firstStageId?: string;
  onCreated: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [customerId, setCustomerId] = React.useState("");
  const [value, setValue] = React.useState("");
  const [source, setSource] = React.useState("");
  const [priority, setPriority] = React.useState("medium");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const customersQuery = useQuery({
    queryKey: ["customers", "deal-create"],
    queryFn: () => crmApi.listCustomers(new URLSearchParams({ limit: "100" })),
    enabled: open,
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Create deal</ModalTitle>
          <ModalDescription>Deals belong to a customer and a pipeline stage.</ModalDescription>
        </ModalHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label required>Deal name</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required aria-required="true" />
          </div>
          <div className="space-y-1.5">
            <Label required>Customer</Label>
            <Select value={customerId || undefined} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {(customersQuery.data?.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Value</Label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["low", "medium", "high", "urgent"].map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={loading}
            onClick={() => {
              void (async () => {
                setLoading(true);
                setError(null);
                try {
                  await crmApi.createDeal({
                    title,
                    customerId,
                    pipelineId,
                    stageId: firstStageId,
                    value: value ? Number(value) : null,
                    source,
                    priority,
                  });
                  onOpenChange(false);
                  setTitle("");
                  setCustomerId("");
                  setValue("");
                  setSource("");
                  onCreated();
                  toast.success("Deal created");
                } catch (err) {
                  const message = err instanceof Error ? err.message : "Create failed";
                  setError(message);
                  toast.error(message);
                } finally {
                  setLoading(false);
                }
              })();
            }}
          >
            Create
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
