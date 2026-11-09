"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import type { StageSlot } from "@/components/ui/stage-rail";
import { formatLeadMoney, formatLeadMoneyCompact } from "@/features/leads/lead-format";
import type { LeadBoardCard, LeadBoardStage } from "@/lib/api/crm";
import { cn } from "@/lib/utils";
import { BoardSortSelect } from "./board-sort-select";
import { LeadCard } from "./lead-card";
import type { BoardSortKey, SortOrder } from "./pipeline-filters";
import { StageDot, stageVars } from "./pipeline-ui";

export const stageDropId = (stageId: string) => `stage:${stageId}`;

export function PipelineColumn({
  stage,
  stages,
  slot,
  currency,
  canEdit,
  dndEnabled,
  loadingMore,
  onLoadMore,
  onOpen,
  onMove,
  className,
  subtitle,
  emptyText,
  boardSort = "updated",
  boardOrder = "desc",
  sortOverridden = false,
  sorting,
  onBoardSortChange,
}: {
  stage: LeadBoardStage;
  stages: LeadBoardStage[];
  slot: StageSlot;
  currency: string;
  canEdit: boolean;
  /** False on the mobile one-stage view, where the Move menu replaces dragging. */
  dndEnabled: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onOpen: (leadId: string) => void;
  onMove: (lead: LeadBoardCard, to: LeadBoardStage) => void;
  className?: string;
  /** Replaces the column value line, e.g. when only some leads are loaded. */
  subtitle?: string;
  /** Replaces the empty-column hint. */
  emptyText?: string;
  boardSort?: BoardSortKey;
  boardOrder?: SortOrder;
  sortOverridden?: boolean;
  sorting?: boolean;
  onBoardSortChange?: (sort: BoardSortKey, order: SortOrder) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageDropId(stage.id), disabled: !dndEnabled });
  const remaining = Math.max(0, stage.count - stage.leads.length);
  const valueLine = subtitle ?? (stage.totalValue > 0 ? formatLeadMoneyCompact(stage.totalValue, currency) : null);

  return (
    <section
      ref={setNodeRef}
      role="group"
      aria-label={`${stage.name}: ${stage.count} ${stage.count === 1 ? "lead" : "leads"}, ${subtitle ?? formatLeadMoney(stage.totalValue, currency)}`}
      style={stageVars(slot)}
      className={cn(
        "flex w-[288px] shrink-0 flex-col rounded-column bg-column-tint transition-[box-shadow,background-color] duration-150 motion-reduce:transition-none",
        isOver && "bg-brand-soft/60 ring-2 ring-brand/30",
        className,
      )}
    >
      <header className="sticky top-0 z-[1] overflow-hidden rounded-t-column bg-inherit px-3.5 pb-2.5 pt-3.5">
        <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-(--col-stage)" />
        <div className="flex items-center gap-2">
          <StageDot slot={slot} />
          <h3 className="min-w-0 flex-1 truncate text-[0.875rem] font-semibold text-ink">{stage.name}</h3>
          <span className="rounded-full bg-surface px-2 py-px text-caption font-medium tabular-nums text-ink-secondary">
            {stage.count}
          </span>
        </div>
        <div className="mt-1.5 flex min-h-7 items-center justify-between gap-2">
          <p className="min-w-0 truncate text-caption tabular-nums text-ink-muted">
            {valueLine ?? (stage.count === 0 ? "No leads" : "\u00a0")}
            {sorting ? <span> · sorting…</span> : null}
          </p>
          {onBoardSortChange ? (
            <BoardSortSelect
              compact
              sort={boardSort}
              order={boardOrder}
              overridden={sortOverridden}
              onChange={onBoardSortChange}
              className="shrink-0"
            />
          ) : null}
        </div>
      </header>

      <div
        className="flex min-h-40 flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 pb-2.5 crm-scroll md:max-h-[calc(100dvh-20rem)]"
      >
        {stage.leads.length === 0 ? (
          <div
            className={cn(
              "flex flex-1 items-center justify-center rounded-card border-[1.5px] border-dashed px-3 py-8 text-center text-caption",
              isOver ? "border-brand/50 text-brand-ink" : "border-line text-ink-muted",
            )}
          >
            {emptyText ??
              (stage.isWon
                ? stage.name.toLowerCase() === "complete"
                  ? "Completed leads land here"
                  : "Won leads land here"
                : stage.isLost
                  ? "Lost leads land here"
                  : "Nothing here — drag a lead in")}
          </div>
        ) : (
          stage.leads.map((lead) =>
            dndEnabled ? (
              <DraggableCard
                key={lead.id}
                lead={lead}
                stageName={stage.name}
                stages={stages}
                canEdit={canEdit}
                onOpen={() => onOpen(lead.id)}
                onMove={(to) => onMove(lead, to)}
              />
            ) : (
              <div
                key={lead.id}
                role="button"
                tabIndex={0}
                aria-label={`${lead.fullName}, ${stage.name}. Press Enter to open.`}
                className="group/card cursor-pointer rounded-card outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onKeyDown={(e) => {
                  if (e.key === "Enter") onOpen(lead.id);
                }}
              >
                <LeadCard
                  lead={lead}
                  stages={stages}
                  canEdit={canEdit}
                  onOpen={() => onOpen(lead.id)}
                  onMove={(to) => onMove(lead, to)}
                />
              </div>
            ),
          )
        )}
        {stage.hasMore ? (
          <Button variant="ghost" size="sm" className="w-full" loading={loadingMore} onClick={onLoadMore}>
            Show {Math.min(remaining, 25)} more
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function DraggableCard({
  lead,
  stageName,
  stages,
  canEdit,
  onOpen,
  onMove,
}: {
  lead: LeadBoardCard;
  stageName: string;
  stages: LeadBoardStage[];
  canEdit: boolean;
  onOpen: () => void;
  onMove: (to: LeadBoardStage) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
    disabled: !canEdit,
  });
  // The DragOverlay follows the pointer; this copy stays put as a faded placeholder.
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-roledescription={canEdit ? "draggable lead" : "lead"}
      aria-label={`${lead.fullName}, ${stageName}. Press Enter to open${canEdit ? ", Space to pick up and move" : ""}.`}
      className="group/card cursor-pointer rounded-card outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onKeyDown={(e) => {
        if (e.key === "Enter" && !isDragging) {
          e.preventDefault();
          onOpen();
          return;
        }
        listeners?.onKeyDown?.(e);
      }}
    >
      <LeadCard lead={lead} stages={stages} canEdit={canEdit} dragging={isDragging} onOpen={onOpen} onMove={onMove} />
    </div>
  );
}
