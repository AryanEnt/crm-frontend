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
import { ClientsEmailControl } from "./clients-email-control";
import { ContactRatingControl } from "./contact-rating-control";
import { isContactedStage } from "./contact-rating";
import { DocumentDelayRemarksControl } from "./document-delay-remarks-control";
import { NegotiationTagControl } from "./negotiation-tag-control";
import { isNegotiationStage } from "./negotiation-tag";
import { NextFollowUpRemarksControl } from "./next-follow-up-remarks-control";
import { requiresNextFollowUpRemarks } from "./next-follow-up-remarks";
import { FileReceivedControl } from "./file-received-control";
import { isClientsStage, isFileDeliveredStage, isOutcomeStage } from "./nurturing-stages";
import { OutcomeLetterControl } from "./outcome-letter-control";
import { PipelineLeadDocumentsControl } from "./pipeline-lead-documents-control";
import { showsAddDocumentSection } from "./pipeline-lead-documents";
import { formatDate } from "./pipeline-format";
import { OwnerAvatar } from "./pipeline-ui";
import { formatStageAgeLabel, stageAge, type StageAgeTone } from "./stage-age";
import { useHourlyNow } from "./use-hourly-now";

const AGE_BORDER: Record<StageAgeTone, string> = {
  none: "border-line/80",
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
  none: "Time in this stage",
  ok: "On time — within the stage limit",
  warn: "Follow up — almost at the stage limit",
  over: "Stuck — past the stage time limit",
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
  stages?: LeadBoardStage[];
  overlay?: boolean;
  dragging?: boolean;
  canEdit?: boolean;
  onOpen?: () => void;
  onMove?: (stage: LeadBoardStage) => void;
}) {
  const { user } = useAuth();
  const timezone = user?.timezone || undefined;
  const now = useHourlyNow();
  const won = lead.status === "won" || Boolean(lead.wonAt);
  const lost = lead.status === "lost";
  const closed = won || lost;
  const tone = nextActionTone(lead.nextActivityAt, timezone);
  const stage = stages?.find((s) => s.id === lead.stageId);
  const age = stageAge(lead.stageEnteredAt, stage?.slaHours, { closed, now });
  const showMenu = !overlay && canEdit && !!stages?.length;
  // Team Leads / admins see whose book the lead sits in; SEs already know their own cards.
  const showOwner = user?.roleCode !== "sales_executive";

  const urgency = closed
    ? "ok"
    : tone === "overdue"
      ? "overdue"
      : age.tone === "over"
        ? "stuck"
        : tone === "today"
          ? "today"
          : tone === "none"
            ? "none"
            : age.tone === "warn"
              ? "soon"
              : "ok";

  const needFollowUp =
    !overlay && !closed && requiresNextFollowUpRemarks(stage?.name) && !(lead.nextFollowUpRemarks ?? "").trim();
  const needRating = !overlay && !closed && isContactedStage(stage?.name) && !(lead.contactRating ?? 0);
  const needNegotiation =
    !overlay && !closed && isNegotiationStage(stage?.name) && !(lead.negotiationTag ?? "").trim();
  const showAddDocument =
    !overlay && showsAddDocumentSection(stage?.name ?? (lost ? "Lost" : won ? "Purchased" : null), lead.status);
  const showClientsEmail = !overlay && isClientsStage(stage?.name) && !!stages?.length;
  const showFileReceived = !overlay && isFileDeliveredStage(stage?.name);
  const showOutcomeLetter = !overlay && isOutcomeStage(stage?.name);

  return (
    <article
      onClick={overlay ? undefined : onOpen}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-surface p-3.5 shadow-xs",
        "transition-[box-shadow,border-color,background-color,opacity] duration-150 motion-reduce:transition-none",
        "group-hover/card:border-line-strong group-hover/card:shadow-card",
        urgency === "overdue" || urgency === "stuck"
          ? "border-danger/70 bg-danger-soft/40"
          : urgency === "today"
            ? "border-warning/60 bg-warning-soft/40"
            : AGE_BORDER[age.tone],
        urgency === "overdue" || urgency === "stuck" || urgency === "today" ? "" : AGE_SURFACE[age.tone],
        overlay && "cursor-grabbing border-line-strong shadow-card",
        dragging && "opacity-40",
      )}
    >
      {age.tone !== "none" && urgency !== "overdue" ? (
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-surface-muted/80">
          <span
            className={cn(
              "block h-full transition-[width] duration-300 motion-reduce:transition-none",
              AGE_BAR[age.tone],
            )}
            style={{ width: `${Math.max(12, age.fillPercent)}%` }}
          />
        </span>
      ) : (
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-0 w-1",
            urgency === "overdue" || urgency === "stuck"
              ? "bg-danger"
              : urgency === "today"
                ? "bg-warning"
                : "bg-transparent",
          )}
        />
      )}

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] font-semibold leading-5 text-ink">{lead.fullName}</p>
          {lead.employer ? <p className="truncate text-caption text-ink-muted">{lead.employer}</p> : null}
        </div>
        {showMenu ? (
          <div
            className="-mr-1 -mt-1"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <MoveMenu lead={lead} stages={stages!} onMove={onMove} />
          </div>
        ) : null}
      </div>

      <div className="mt-2.5">
        {lost ? (
          <p className="truncate text-caption text-ink-muted">
            Lost{lead.lostReason ? ` · ${lead.lostReason}` : ""}
          </p>
        ) : won ? (
          <p className="truncate text-caption text-ink-muted">{`Purchased ${formatDate(lead.wonAt)}`}</p>
        ) : lead.documentDeadlineAt ? (
          <p
            className={cn(
              "flex items-center gap-1.5 text-[0.8125rem] font-medium",
              nextActionTone(lead.documentDeadlineAt, timezone) === "overdue"
                ? "text-danger"
                : nextActionTone(lead.documentDeadlineAt, timezone) === "today"
                  ? "text-warning"
                  : "text-ink-secondary",
            )}
          >
            <CalendarClock className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{formatDocumentDeadline(lead.documentDeadlineAt, timezone)}</span>
          </p>
        ) : (
          <p
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[0.8125rem]",
              urgency === "overdue" && "bg-danger-soft font-medium text-danger",
              urgency === "today" && "bg-warning-soft font-medium text-warning",
              urgency === "none" && "border border-dashed border-warning/50 bg-warning-soft/40 font-medium text-warning",
              (urgency === "ok" || urgency === "soon" || urgency === "stuck") && "bg-surface-muted/60 text-ink-secondary",
            )}
          >
            <CalendarClock className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {formatNextAction(lead.nextActivityAt, timezone)}
              {tone !== "none" && lead.nextActivityTitle ? ` · ${lead.nextActivityTitle}` : ""}
            </span>
          </p>
        )}
      </div>

      {!closed ? (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-caption tabular-nums text-ink-secondary",
                lead.potentialValue == null && "text-ink-muted",
              )}
            >
              {lead.potentialValue != null ? formatLeadMoney(lead.potentialValue, lead.currency) : "No value yet"}
            </span>
            <span className="ml-auto flex min-w-0 items-center gap-1.5">
              {urgency === "stuck" ? (
                <span className="inline-flex shrink-0 items-center rounded-full bg-danger-soft px-1.5 py-px text-[0.6875rem] font-medium text-danger">
                  Stuck
                </span>
              ) : urgency === "soon" ? (
                <span className="inline-flex shrink-0 items-center rounded-full bg-warning-soft px-1.5 py-px text-[0.6875rem] font-medium text-warning">
                  Follow up
                </span>
              ) : null}
              <span
                className={cn("max-w-[9.5rem] truncate text-caption tabular-nums", AGE_DAYS[age.tone])}
                title={`${AGE_TITLE[age.tone]} · ${formatStageAgeLabel(age)}`}
              >
                {formatStageAgeLabel(age)}
              </span>
            </span>
          </div>
          {showOwner ? (
            <div className="flex min-w-0 items-center gap-1.5" title={lead.ownerName ?? "Unassigned"}>
              <OwnerAvatar id={lead.ownerUserId} name={lead.ownerName} size="sm" className="size-5 text-[0.5625rem]" />
              <span className="truncate text-caption text-ink-muted">{lead.ownerName?.trim() || "Unassigned"}</span>
            </div>
          ) : null}
        </div>
      ) : showOwner ? (
        <div className="mt-2 flex min-w-0 items-center gap-1.5" title={lead.ownerName ?? "Unassigned"}>
          <OwnerAvatar id={lead.ownerUserId} name={lead.ownerName} size="sm" className="size-5 text-[0.5625rem]" />
          <span className="truncate text-caption text-ink-muted">{lead.ownerName?.trim() || "Unassigned"}</span>
        </div>
      ) : null}

      {needFollowUp ? <NextFollowUpRemarksControl lead={lead} stageName={stage?.name} canEdit={!!canEdit} /> : null}
      {needRating ? <ContactRatingControl lead={lead} stageName={stage?.name} canEdit={!!canEdit} /> : null}
      {needNegotiation ? <NegotiationTagControl lead={lead} canEdit={!!canEdit} /> : null}
      {showAddDocument ? (
        <PipelineLeadDocumentsControl
          lead={lead}
          stageName={stage?.name ?? (lost ? "Lost" : won ? "Purchased" : null)}
          canEdit={!!canEdit}
        />
      ) : null}
      {showClientsEmail ? <ClientsEmailControl lead={lead} stages={stages!} canEdit={!!canEdit} /> : null}
      {showFileReceived ? <FileReceivedControl lead={lead} canEdit={!!canEdit} /> : null}
      {showOutcomeLetter ? <OutcomeLetterControl lead={lead} canEdit={!!canEdit} /> : null}
      {!overlay ? <DocumentDelayRemarksControl lead={lead} canEdit={!!canEdit} /> : null}
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
  const completeOnly = outcomes.some((s) => s.isWon) && !outcomes.some((s) => s.isLost);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Move ${lead.fullName}`}
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
            {s.isWon
              ? completeOnly
                ? s.name || "Outcome"
                : `Mark as ${(s.name || "Purchased").toLowerCase()}`
              : "Mark as lost"}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
