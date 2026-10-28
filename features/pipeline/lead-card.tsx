"use client";

import { CalendarClock, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  daysSince,
  formatDocumentDeadline,
  formatLeadMoney,
  formatNextAction,
  nextActionTone,
} from "@/features/leads/lead-format";
import { useAuth } from "@/features/auth/auth-provider";
import type { LeadBoardCard, LeadBoardStage } from "@/lib/api/crm";
import { cn } from "@/lib/utils";
import { formatDate } from "./pipeline-format";
import { OwnerAvatar } from "./pipeline-ui";

const TONE_CLASS = {
  overdue: "text-danger",
  today: "text-warning",
  upcoming: "text-ink-secondary",
  none: "text-ink-muted",
} as const;

export function LeadCard({
  lead,
  stages,
  overlay,
  dragging,
  canEdit,
  onOpen,
  onMove,
}: {
  lead: LeadBoardCard;
  /** Stages offered in the "Move to" menu, which is the non-drag way to move a lead. */
  stages?: LeadBoardStage[];
  /** The floating copy that follows the pointer while dragging. */
  overlay?: boolean;
  /** The placeholder left in the column while its copy is being dragged. */
  dragging?: boolean;
  canEdit?: boolean;
  onOpen?: () => void;
  onMove?: (stage: LeadBoardStage) => void;
}) {
  const { user } = useAuth();
  const timezone = user?.timezone || undefined;
  const closed = lead.status === "won" || lead.status === "lost";
  const tone = nextActionTone(lead.nextActivityAt, timezone);
  const days = daysSince(lead.stageEnteredAt);
  const showMenu = !overlay && canEdit && !!stages?.length;

  return (
    <article
      onClick={overlay ? undefined : onOpen}
      className={cn(
        "relative rounded-card border border-line/70 bg-surface p-3 shadow-card",
        "transition-[box-shadow,border-color,opacity] duration-150 motion-reduce:transition-none",
        "group-hover/card:border-line-strong group-hover/card:shadow-lift",
        overlay && "cursor-grabbing border-line-strong shadow-lift",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.875rem] font-semibold leading-5 text-ink">{lead.fullName}</p>
          {lead.employer ? <p className="truncate text-caption text-ink-muted">{lead.employer}</p> : null}
        </div>
        {showMenu ? (
          <div
            className="-mr-1 -mt-1 opacity-0 transition-opacity duration-150 group-hover/card:opacity-100 group-focus-within/card:opacity-100 motion-reduce:transition-none pointer-coarse:opacity-100"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <MoveMenu lead={lead} stages={stages!} onMove={onMove} />
          </div>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <span className={cn("text-[0.875rem] font-semibold tabular-nums", lead.potentialValue == null && "font-normal text-ink-muted")}>
          {lead.potentialValue != null ? formatLeadMoney(lead.potentialValue, lead.currency) : "No value"}
        </span>
        <span className="ml-auto text-caption tabular-nums text-ink-muted" title="Days in this stage">
          {days}d
        </span>
        <OwnerAvatar id={lead.ownerUserId} name={lead.ownerName} />
      </div>

      {closed ? (
        <p
          className={cn(
            "mt-2 truncate text-caption",
            lead.status === "won" ? "text-stage-won-ink" : "text-stage-lost-ink",
          )}
        >
          {lead.status === "won"
            ? `Won ${formatDate(lead.wonAt)}`
            : `Lost${lead.lostReason ? ` · ${lead.lostReason}` : ` ${formatDate(lead.lostAt)}`}`}
        </p>
      ) : lead.documentDeadlineAt ? (
        <p
          className={cn(
            "mt-2 flex min-w-0 items-center gap-1.5 text-caption",
            TONE_CLASS[nextActionTone(lead.documentDeadlineAt, timezone)],
          )}
        >
          <CalendarClock className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate font-medium">{formatDocumentDeadline(lead.documentDeadlineAt, timezone)}</span>
        </p>
      ) : (
        <p className={cn("mt-2 flex min-w-0 items-center gap-1.5 text-caption", TONE_CLASS[tone])}>
          <CalendarClock className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            <span className={cn(tone !== "none" && "font-medium")}>{formatNextAction(lead.nextActivityAt, timezone)}</span>
            {tone !== "none" && lead.nextActivityTitle ? (
              <span className="text-ink-muted"> · {lead.nextActivityTitle}</span>
            ) : null}
          </span>
        </p>
      )}
    </article>
  );
}

function MoveMenu({
  lead,
  stages,
  onMove,
}: {
  lead: LeadBoardCard;
  stages: LeadBoardStage[];
  onMove?: (stage: LeadBoardStage) => void;
}) {
  const open = stages.filter((s) => !s.isWon && !s.isLost);
  const outcomes = stages.filter((s) => s.isWon || s.isLost);
  // Nurturing has a Complete outcome and no Lost; sales has Won + Lost.
  const completeOnly = outcomes.some((s) => s.isWon) && !outcomes.some((s) => s.isLost);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Move ${lead.fullName} to another stage`}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        {open.map((s) => (
          <DropdownMenuItem key={s.id} disabled={s.id === lead.stageId} onSelect={() => onMove?.(s)}>
            {s.name}
          </DropdownMenuItem>
        ))}
        {outcomes.length ? <DropdownMenuSeparator /> : null}
        {outcomes.map((s) => (
          <DropdownMenuItem
            key={s.id}
            disabled={s.id === lead.stageId}
            onSelect={() => onMove?.(s)}
            className={s.isWon ? "text-success" : "text-danger"}
          >
            {s.isWon ? (completeOnly ? s.name || "Complete" : "Mark as won") : "Mark as lost"}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
