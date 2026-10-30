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
import { stageAge, type StageAgeTone } from "./stage-age";

const TONE_CLASS = {
  overdue: "text-danger",
  today: "text-warning",
  upcoming: "text-ink-secondary",
  none: "text-ink-muted",
} as const;

const AGE_BORDER: Record<StageAgeTone, string> = {
  none: "border-line/70",
  ok: "border-success/55",
  warn: "border-warning/70",
  over: "border-danger/80",
};

const AGE_SURFACE: Record<StageAgeTone, string> = {
  none: "",
  ok: "bg-success-soft/50",
  warn: "bg-warning-soft/70",
  over: "bg-danger-soft/60",
};

const AGE_DAYS: Record<StageAgeTone, string> = {
  none: "text-ink-muted",
  ok: "text-success font-medium",
  warn: "text-warning font-semibold",
  over: "text-danger font-semibold",
};

const AGE_BAR: Record<StageAgeTone, string> = {
  none: "bg-transparent",
  ok: "bg-success",
  warn: "bg-warning",
  over: "bg-danger",
};

const AGE_TITLE: Record<StageAgeTone, string> = {
  none: "Days in this stage",
  ok: "On track — within stage time limit",
  warn: "Near limit — follow up soon",
  over: "Overdue — past stage time limit",
};

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
  // Sales Won keeps wonAt after handoff to Nurturing (status becomes open again).
  const won = lead.status === "won" || Boolean(lead.wonAt);
  const lost = lead.status === "lost";
  const closed = won || lost;
  const tone = nextActionTone(lead.nextActivityAt, timezone);
  const stage = stages?.find((s) => s.id === lead.stageId);
  const age = stageAge(lead.stageEnteredAt, stage?.slaHours, { closed });
  const showMenu = !overlay && canEdit && !!stages?.length;

  return (
    <article
      onClick={overlay ? undefined : onOpen}
      className={cn(
        "relative overflow-hidden rounded-card border bg-surface p-3 shadow-card",
        "transition-[box-shadow,border-color,background-color,opacity] duration-150 motion-reduce:transition-none",
        "group-hover/card:border-line-strong group-hover/card:shadow-lift",
        AGE_BORDER[age.tone],
        AGE_SURFACE[age.tone],
        overlay && "cursor-grabbing border-line-strong shadow-lift",
        dragging && "opacity-40",
      )}
    >
      {age.tone !== "none" ? (
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-surface-muted/80">
          <span
            className={cn("block h-full transition-[width] duration-300 motion-reduce:transition-none", AGE_BAR[age.tone])}
            style={{ width: `${Math.max(12, age.fillPercent)}%` }}
          />
        </span>
      ) : null}
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
        <span
          className={cn("text-[0.875rem] font-semibold tabular-nums", lead.potentialValue == null && "font-normal text-ink-muted")}
          title={lead.potentialValue != null ? "Estimated value" : "No estimate yet"}
        >
          {lead.potentialValue != null ? formatLeadMoney(lead.potentialValue, lead.currency) : "No estimate"}
        </span>
        <span className="ml-auto flex min-w-0 items-center gap-1.5">
          {age.tone === "over" ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-danger-soft px-1.5 py-px text-[0.625rem] font-semibold uppercase tracking-wide text-danger">
              Overdue
            </span>
          ) : age.tone === "warn" ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-warning-soft px-1.5 py-px text-[0.625rem] font-semibold uppercase tracking-wide text-warning">
              Soon
            </span>
          ) : null}
          <span className={cn("text-caption tabular-nums", AGE_DAYS[age.tone])} title={AGE_TITLE[age.tone]}>
            {age.days}d
          </span>
        </span>
        <OwnerAvatar id={lead.ownerUserId} name={lead.ownerName} />
      </div>

      {lost ? (
        <p className="mt-2 truncate text-caption text-stage-lost-ink">
          {`Lost${lead.lostReason ? ` · ${lead.lostReason}` : ` ${formatDate(lead.lostAt)}`}`}
        </p>
      ) : won ? (
        <p className="mt-2 truncate text-caption text-stage-won-ink">{`Won ${formatDate(lead.wonAt)}`}</p>
      ) : null}
      {!lost && lead.documentDeadlineAt ? (
        <p
          className={cn(
            "mt-2 flex min-w-0 items-center gap-1.5 text-caption",
            TONE_CLASS[nextActionTone(lead.documentDeadlineAt, timezone)],
          )}
        >
          <CalendarClock className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate font-medium">{formatDocumentDeadline(lead.documentDeadlineAt, timezone)}</span>
        </p>
      ) : !closed ? (
        <p className={cn("mt-2 flex min-w-0 items-center gap-1.5 text-caption", TONE_CLASS[tone])}>
          <CalendarClock className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            <span className={cn(tone !== "none" && "font-medium")}>{formatNextAction(lead.nextActivityAt, timezone)}</span>
            {tone !== "none" && lead.nextActivityTitle ? (
              <span className="text-ink-muted"> · {lead.nextActivityTitle}</span>
            ) : null}
          </span>
        </p>
      ) : null}
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
