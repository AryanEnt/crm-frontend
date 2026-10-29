"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CircleX, Trophy } from "lucide-react";
import { findCard } from "@/features/leads/lead-board-state";
import type { LeadBoardCard, LeadBoardStage } from "@/lib/api/crm";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { LeadCard } from "./lead-card";
import { PipelineColumn, stageDropId } from "./pipeline-column";
import { StageDot, stageSlot } from "./pipeline-ui";
import type { PipelineData } from "./use-pipeline-leads";

const OUTCOME_WON = "outcome:won";
const OUTCOME_LOST = "outcome:lost";

/** The fixed Won/Lost bar sits over the columns, so prefer what is under the pointer. */
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : closestCorners(args);
};

export function PipelineBoard({
  data,
  showClosedColumns,
  canEdit,
  nurturing = false,
  onOpenLead,
  onMove,
}: {
  data: PipelineData;
  /** "All" shows Won and Lost as columns; "Open" keeps them as drop targets only. */
  showClosedColumns: boolean;
  canEdit: boolean;
  /** Nurturing's isWon drop zone is Complete, not Won. */
  nurturing?: boolean;
  onOpenLead: (leadId: string) => void;
  onMove: (lead: LeadBoardCard, to: LeadBoardStage) => void;
}) {
  const { board, stages, openStages, wonStage, lostStage, currency } = data;
  const columns = showClosedColumns ? stages : openStages;
  const isDesktop = useMediaQuery("(min-width: 768px)", true);
  const [active, setActive] = React.useState<LeadBoardCard | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  const targetFor = (overId: string | undefined): LeadBoardStage | null => {
    if (!overId) return null;
    if (overId === OUTCOME_WON) return wonStage;
    if (overId === OUTCOME_LOST) return lostStage;
    return stages.find((s) => stageDropId(s.id) === overId) ?? null;
  };

  const leadName = (id: string | number) => (board ? findCard(board, String(id))?.card.fullName : undefined) ?? "Lead";
  const targetName = (id: string | number | undefined) => targetFor(id?.toString())?.name ?? "a stage";
  const announcements: Announcements = {
    onDragStart: ({ active: a }) =>
      `Picked up ${leadName(a.id)}. Use the arrow keys to choose a stage, Space to drop, Escape to cancel.`,
    onDragOver: ({ active: a, over }) =>
      over ? `${leadName(a.id)} is over ${targetName(over.id)}.` : `${leadName(a.id)} is not over a stage.`,
    onDragEnd: ({ active: a, over }) =>
      over ? `${leadName(a.id)} dropped on ${targetName(over.id)}.` : `${leadName(a.id)} returned to its stage.`,
    onDragCancel: ({ active: a }) => `Move cancelled. ${leadName(a.id)} stays where it was.`,
  };

  const onDragStart = (event: DragStartEvent) =>
    setActive((event.active.data.current?.lead as LeadBoardCard | undefined) ?? null);

  const onDragEnd = (event: DragEndEvent) => {
    setActive(null);
    const lead = event.active.data.current?.lead as LeadBoardCard | undefined;
    const to = targetFor(event.over?.id?.toString());
    if (lead && to && canEdit) onMove(lead, to);
  };

  if (!isDesktop) {
    return (
      <MobileStages
        columns={columns}
        stages={stages}
        currency={currency}
        canEdit={canEdit}
        loadingMore={data.loadingMore}
        onLoadMore={(s) => void data.loadMore(s)}
        onOpen={onOpenLead}
        onMove={onMove}
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{ announcements }}
    >
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-4 crm-scroll">
        {columns.map((stage) => (
          <PipelineColumn
            key={stage.id}
            stage={stage}
            stages={stages}
            slot={stageSlot(stage, stages)}
            currency={currency}
            canEdit={canEdit}
            dndEnabled
            loadingMore={data.loadingMore === stage.id}
            onLoadMore={() => void data.loadMore(stage)}
            onOpen={onOpenLead}
            onMove={onMove}
          />
        ))}
      </div>

      {active && canEdit && (wonStage || lostStage) ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div
            role="group"
            aria-label="Close the lead"
            className="outcome-dock pointer-events-auto flex items-stretch gap-2 rounded-2xl border border-line bg-surface/90 p-2 shadow-lift backdrop-blur-md"
          >
            {wonStage ? (
              <OutcomeDropZone kind="won" complete={nurturing} disabled={active.stageId === wonStage.id} />
            ) : null}
            {wonStage && lostStage ? <div className="my-2 w-px bg-line" aria-hidden /> : null}
            {lostStage ? <OutcomeDropZone kind="lost" disabled={active.stageId === lostStage.id} /> : null}
          </div>
        </div>
      ) : null}

      <DragOverlay dropAnimation={null}>{active ? <LeadCard lead={active} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

function OutcomeDropZone({
  kind,
  disabled,
  complete = false,
}: {
  kind: "won" | "lost";
  disabled: boolean;
  complete?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: kind === "won" ? OUTCOME_WON : OUTCOME_LOST, disabled });
  const won = kind === "won";
  const Icon = won ? Trophy : CircleX;
  const success = complete ? "Complete" : "Won";
  const hint = disabled
    ? won
      ? complete
        ? "Already complete"
        : "Already won"
      : "Already lost"
    : won
      ? complete
        ? "Drop to complete"
        : "Drop to close as won"
      : "Drop to close · add a reason";
  return (
    <div
      ref={setNodeRef}
      aria-disabled={disabled}
      className={cn(
        "flex w-60 items-center gap-3 rounded-xl border border-dashed px-3 py-2.5",
        "transition-[background-color,border-color,transform,opacity] duration-150 ease-out motion-reduce:transition-none",
        disabled && "opacity-40",
        !isOver && "border-transparent",
        !disabled && isOver && "scale-[1.03] border-solid",
        isOver && (won ? "border-stage-won/60 bg-stage-won-soft" : "border-stage-lost/60 bg-stage-lost-soft"),
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150 motion-reduce:transition-none",
          won ? "bg-stage-won-soft text-stage-won-ink" : "bg-stage-lost-soft text-stage-lost-ink",
          isOver && (won ? "bg-stage-won text-white" : "bg-stage-lost text-white"),
        )}
      >
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className={cn("block text-[0.875rem] font-semibold", won ? "text-stage-won-ink" : "text-stage-lost-ink")}>
          {won ? success : "Lost"}
        </span>
        <span className="block truncate text-[0.75rem] text-ink-muted">{hint}</span>
      </span>
    </div>
  );
}

function MobileStages({
  columns,
  stages,
  currency,
  canEdit,
  loadingMore,
  onLoadMore,
  onOpen,
  onMove,
}: {
  columns: LeadBoardStage[];
  stages: LeadBoardStage[];
  currency: string;
  canEdit: boolean;
  loadingMore: string | null;
  onLoadMore: (stage: LeadBoardStage) => void;
  onOpen: (leadId: string) => void;
  onMove: (lead: LeadBoardCard, to: LeadBoardStage) => void;
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = columns.find((s) => s.id === selectedId) ?? columns[0];
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  if (!selected) return null;

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + columns.length) % columns.length;
    setSelectedId(columns[next]!.id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Pipeline stages" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 crm-scroll">
        {columns.map((s, i) => {
          const on = s.id === selected.id;
          return (
            <button
              key={s.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`stage-tab-${s.id}`}
              aria-selected={on}
              aria-controls={`stage-panel-${s.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setSelectedId(s.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-medium",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
              )}
            >
              <StageDot slot={stageSlot(s, stages)} />
              {s.name}
              <span className="tabular-nums text-ink-muted">{s.count}</span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`stage-panel-${selected.id}`} aria-labelledby={`stage-tab-${selected.id}`}>
        <PipelineColumn
          stage={selected}
          stages={stages}
          slot={stageSlot(selected, stages)}
          currency={currency}
          canEdit={canEdit}
          dndEnabled={false}
          loadingMore={loadingMore === selected.id}
          onLoadMore={() => onLoadMore(selected)}
          onOpen={onOpen}
          onMove={onMove}
          className="w-full"
        />
      </div>
    </div>
  );
}
