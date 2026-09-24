"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarPlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
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
import { crmApi, type Deal, type PipelineStage, type StageMoveError } from "@/lib/api/crm";
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

const accentBar: Record<string, string> = {
  neutral: "bg-foreground-subtle",
  slate: "bg-foreground-muted",
  blue: "bg-info",
  teal: "bg-brand",
  green: "bg-success",
  amber: "bg-warning",
  orange: "bg-warning",
  rose: "bg-destructive",
  violet: "bg-brand",
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

function priorityTone(p: string) {
  return p === "urgent" ? "danger" : p === "high" ? "warning" : p === "low" ? "neutral" : "brand";
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

  const boardQuery = useQuery({
    queryKey: ["deal-board", activePipelineId],
    queryFn: () => crmApi.getDealBoard(activePipelineId),
    enabled: !!activePipelineId,
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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
    }) =>
      crmApi.moveDeal(dealId, {
        stageId,
        pipelineId: activePipelineId,
        force,
        lostReason,
      }),
    onSuccess: (_d, vars) => {
      setBlockers(null);
      setLostPending(null);
      void qc.invalidateQueries({ queryKey: ["deal-board", activePipelineId] });
      toast.success(vars.lostReason ? "Deal marked lost" : "Deal stage updated");
    },
    onError: (err, vars) => {
      if (err instanceof ApiError && err.status === 400 && err.details) {
        setBlockers({
          dealId: vars.dealId,
          stageId: vars.stageId,
          details: err.details as StageMoveError,
          lostReason: vars.lostReason,
        });
        toast.warning("Stage move blocked — review requirements");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not move deal");
    },
  });

  const pipeline = boardQuery.data?.pipeline;
  const wonStage = findOutcomeStage(pipeline, "won");
  const lostStage = findOutcomeStage(pipeline, "lost");

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
      <PageHeader
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Deals" }]}
        title="Deals"
        description="Pipeline workbench — drag stages, mark won or lost, and keep a next activity on every open deal."
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

      <div className="grid gap-2 rounded-lg border border-border bg-surface px-3 py-2 sm:grid-cols-4">
        <div>
          <p className="text-[11px] text-foreground-subtle">Open deals</p>
          <p className="text-sm font-semibold">{boardStats.count}</p>
        </div>
        <div>
          <p className="text-[11px] text-foreground-subtle">Pipeline value</p>
          <p className="text-sm font-semibold">{formatMoney(boardStats.value)}</p>
        </div>
        <div>
          <p className="text-[11px] text-foreground-subtle">Weighted forecast</p>
          <p className="text-sm font-semibold">{formatMoney(boardStats.weighted)}</p>
        </div>
        <div>
          <p className="text-[11px] text-foreground-subtle">Missing next activity</p>
          <p className={cn("text-sm font-semibold", boardStats.noNext > 0 && "text-warning")}>
            {boardStats.noNext}
          </p>
        </div>
      </div>

      {!activePipelineId || boardQuery.isLoading ? (
        <LoadingState label="Loading board…" />
      ) : boardQuery.isError || !boardQuery.data ? (
        <ErrorState onRetry={() => void boardQuery.refetch()} />
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
                deals={col.deals}
                canEdit={can("deals:edit")}
                canCreateActivity={can("activities:create")}
                wonStage={wonStage}
                lostStage={lostStage}
                onWon={(deal) => wonStage && requestMove(deal, wonStage)}
                onLost={(deal) => lostStage && requestMove(deal, lostStage)}
                onAddActivity={setActivityDeal}
              />
            ))}
          </div>
          <DragOverlay>
            {activeDeal ? <DealCard deal={activeDeal} overlay /> : null}
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
  deals,
  canEdit,
  canCreateActivity,
  wonStage,
  lostStage,
  onWon,
  onLost,
  onAddActivity,
}: {
  stage: PipelineStage;
  deals: Deal[];
  canEdit: boolean;
  canCreateActivity: boolean;
  wonStage: PipelineStage | null;
  lostStage: PipelineStage | null;
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
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-[280px] shrink-0 flex-col rounded-lg border border-border bg-surface-muted/40",
        stage.isWon && "border-success/30",
        stage.isLost && "border-destructive/30",
        isOver && "ring-2 ring-brand/40",
      )}
    >
      <header className="border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", accentBar[stage.visualAccent] ?? accentBar.neutral)} />
          <h3 className="truncate text-sm font-semibold">{stage.name}</h3>
          <span className="ml-auto text-[11px] text-foreground-subtle">{deals.length}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-foreground-subtle">
          {formatMoney(total)} · {stage.probability}%
          {stage.isWon || stage.isLost ? "" : ` · forecast ${formatMoney(weighted)}`}
          {stage.slaHours ? ` · SLA ${stage.slaHours}h` : ""}
        </p>
      </header>
      <div className="flex max-h-[calc(100vh-280px)] flex-col gap-2 overflow-y-auto p-2">
        {deals.map((deal) => (
          <DraggableDeal
            key={deal.id}
            deal={deal}
            canEdit={canEdit}
            canCreateActivity={canCreateActivity}
            wonStage={wonStage}
            lostStage={lostStage}
            onWon={onWon}
            onLost={onLost}
            onAddActivity={onAddActivity}
          />
        ))}
      </div>
    </section>
  );
}

function DraggableDeal({
  deal,
  canEdit,
  canCreateActivity,
  wonStage,
  lostStage,
  onWon,
  onLost,
  onAddActivity,
}: {
  deal: Deal;
  canEdit: boolean;
  canCreateActivity: boolean;
  wonStage: PipelineStage | null;
  lostStage: PipelineStage | null;
  onWon: (deal: Deal) => void;
  onLost: (deal: Deal) => void;
  onAddActivity: (deal: Deal) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { deal },
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <DealCard
        deal={deal}
        canEdit={canEdit}
        canCreateActivity={canCreateActivity}
        wonStage={wonStage}
        lostStage={lostStage}
        onWon={() => onWon(deal)}
        onLost={() => onLost(deal)}
        onAddActivity={() => onAddActivity(deal)}
      />
    </div>
  );
}

function DealCard({
  deal,
  overlay,
  canEdit,
  canCreateActivity,
  wonStage,
  lostStage,
  onWon,
  onLost,
  onAddActivity,
}: {
  deal: Deal;
  overlay?: boolean;
  canEdit?: boolean;
  canCreateActivity?: boolean;
  wonStage?: PipelineStage | null;
  lostStage?: PipelineStage | null;
  onWon?: () => void;
  onLost?: () => void;
  onAddActivity?: () => void;
}) {
  const missingNext = deal.status === "open" && !deal.nextActivityAt;
  return (
    <article
      className={cn(
        "rounded-md border border-border bg-surface p-2.5 shadow-sm",
        overlay && "shadow-md ring-1 ring-border",
        missingNext && "border-warning/50 bg-warning-soft/30",
        deal.status === "won" && "border-success/40",
        deal.status === "lost" && "border-destructive/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/deals/${deal.id}`}
            className="block truncate text-sm font-medium text-foreground hover:text-brand-dark"
            onClick={(e) => e.stopPropagation()}
          >
            {deal.title}
          </Link>
          <p className="truncate text-xs text-foreground-muted">{deal.customerName}</p>
        </div>
        <StatusBadge tone={priorityTone(deal.priority)}>{deal.priority}</StatusBadge>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-foreground-muted">
        <div>
          <dt className="text-foreground-subtle">Owner</dt>
          <dd className="truncate text-foreground">{deal.ownerName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-foreground-subtle">Value</dt>
          <dd className="text-foreground">{formatMoney(deal.value, deal.currency)}</dd>
        </div>
        <div>
          <dt className="text-foreground-subtle">Close</dt>
          <dd className="text-foreground">{deal.expectedCloseAt ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-foreground-subtle">Next</dt>
          <dd className={cn("text-foreground", missingNext && "font-medium text-warning")}>
            {missingNext ? "None" : formatWhen(deal.nextActivityAt)}
          </dd>
        </div>
      </dl>
      {deal.status === "lost" && deal.lostReason ? (
        <p className="mt-2 text-[11px] text-destructive">Lost: {deal.lostReason}</p>
      ) : null}
      {deal.attention ? (
        <p className="mt-2 text-[11px] text-warning">{attentionLabel[deal.attention] ?? deal.attention}</p>
      ) : null}
      {!overlay ? (
        <div
          className="mt-2 flex flex-wrap items-center gap-1.5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {canCreateActivity && deal.status === "open" ? (
            <Button
              size="sm"
              variant="outline"
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
