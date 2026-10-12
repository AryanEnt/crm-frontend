"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Check, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { crmApi, type Activity } from "@/lib/api/crm";
import { addDays, dayKeyInTimezone, formatInTimezone, todayInTimezone } from "@/lib/timezone";
import type { ActivityContext } from "./activity-quick-create";
import { leadHref } from "./activity-href";
import { leadMovedMessage } from "./lead-moved";
import {
  eventEnd,
  eventInstant,
  formatClock,
  instantAt,
  isOpen,
  minutesInTimezone,
  rescheduleFields,
  statusTone,
  useUpdateActivity,
} from "./calendar-utils";

const pad = (n: number) => String(n).padStart(2, "0");
const HOUR_MS = 60 * 60_000;
const QUARTER_MS = 15 * 60_000;

function toZonedInput(d: Date, timezone: string) {
  const minutes = minutesInTimezone(d, timezone);
  return `${dayKeyInTimezone(d, timezone)}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function fromZonedInput(value: string, timezone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match.map(Number);
  return instantAt(new Date(y, m - 1, d), hh * 60 + mm, timezone);
}

export function CalendarEventDialog({
  activity,
  timezone,
  canEdit,
  canCreate,
  onOpenChange,
  onScheduleNext,
}: {
  activity: Activity | null;
  timezone: string;
  canEdit: boolean;
  canCreate: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduleNext: (context: ActivityContext) => void;
}) {
  const detailQuery = useQuery({
    queryKey: ["activity", activity?.id],
    queryFn: () => crmApi.getActivity(activity!.id),
    enabled: !!activity,
  });
  const update = useUpdateActivity();
  const [draft, setDraft] = React.useState("");
  const [draftFor, setDraftFor] = React.useState<string | null>(null);

  const a = detailQuery.data?.activity ?? activity;
  const ctx = detailQuery.data?.context;

  if (a && draftFor !== a.id) {
    setDraftFor(a.id);
    setDraft(toZonedInput(eventInstant(a), timezone));
  }

  const customerId = ctx?.customerId ?? a?.customerId;
  const dealId = ctx?.dealId ?? a?.dealId;
  const leadName = a?.leadName ?? ctx?.leadName;
  const context: ActivityContext = { leadId: a?.leadId, customerId, dealId };
  const editable = Boolean(a && canEdit && isOpen(a));

  const move = (start: Date) => {
    if (!a) return;
    update.mutate(
      { activity: a, fields: rescheduleFields(a, start) },
      {
        onSuccess: () => {
          toast.success(`Moved to ${formatInTimezone(start, timezone, { dateStyle: "medium", timeStyle: "short" })}`);
          onOpenChange(false);
        },
      },
    );
  };

  const sameTimeIn = (days: number) => () =>
    instantAt(
      addDays(todayInTimezone(timezone), days),
      minutesInTimezone(eventInstant(a!), timezone),
      timezone,
    );
  const quickMoves = [
    { label: "In 1 hour", at: () => new Date(Math.ceil((Date.now() + HOUR_MS) / QUARTER_MS) * QUARTER_MS) },
    { label: "Tomorrow", at: sameTimeIn(1) },
    { label: "Next week", at: sameTimeIn(7) },
  ];

  const complete = () => {
    if (!a) return;
    update.mutate(
      { activity: a, fields: { status: "completed", displayStatus: "completed" } },
      {
        onSuccess: (result) => {
          onOpenChange(false);
          const moved = leadMovedMessage(result);
          if (result.needsNextActivity && canCreate) {
            toast.success("Marked complete", {
              description: moved ? `${moved}. It has no next step yet.` : "This record has no next step yet.",
              action: { label: "Schedule next", onClick: () => onScheduleNext(context) },
            });
          } else {
            toast.success("Marked complete", { description: moved });
          }
        },
      },
    );
  };

  const when = a
    ? `${formatInTimezone(eventInstant(a), timezone, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} · ${formatClock(
        minutesInTimezone(eventInstant(a), timezone),
      )} – ${formatClock(minutesInTimezone(eventEnd(a), timezone))}`
    : null;

  return (
    <Modal open={!!activity} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle className={a && !isOpen(a) ? "line-through decoration-foreground-subtle" : undefined}>
            {a?.title ?? "Activity"}
          </ModalTitle>
          <ModalDescription>{when}</ModalDescription>
        </ModalHeader>
        {a ? (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={statusTone(a.displayStatus)}>{a.displayStatus}</StatusBadge>
              <StatusBadge tone="neutral">{a.typeName ?? a.kind}</StatusBadge>
              {a.priority ? <StatusBadge tone="brand">{a.priority} priority</StatusBadge> : null}
            </div>

            <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-2 gap-y-1.5 rounded-lg border border-border bg-surface-muted/40 p-3 text-xs">
              <dt className="text-foreground-subtle">Owner</dt>
              <dd>{a.ownerName ?? "—"}</dd>
              {a.createdByName && a.createdByUserId !== a.ownerUserId ? (
                <>
                  <dt className="text-foreground-subtle">Assigned by</dt>
                  <dd>{a.createdByName}</dd>
                </>
              ) : null}
              <dt className="text-foreground-subtle">Lead</dt>
              <dd className="truncate">
                {a.leadId ? (
                  <Link href={leadHref(a.leadId)} className="font-medium text-brand-dark hover:underline">
                    {leadName ?? "Open lead"}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
              {!a.leadId && (customerId || dealId) ? (
                <>
                  <dt className="text-foreground-subtle">Legacy record</dt>
                  <dd className="truncate text-foreground-subtle">
                    {a.customerName ?? ctx?.customerName ?? a.dealTitle ?? ctx?.dealTitle ?? "—"}
                  </dd>
                </>
              ) : null}
            </dl>

            {a.notes ? (
              <p className="whitespace-pre-wrap rounded-lg bg-surface-muted/40 p-3 text-xs text-foreground-muted">
                {a.notes}
              </p>
            ) : null}

            {editable ? (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <CalendarClock className="size-3.5 text-foreground-muted" />
                  Reschedule
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {quickMoves.map((q) => (
                    <Button
                      key={q.label}
                      size="sm"
                      variant="secondary"
                      disabled={update.isPending}
                      onClick={() => move(q.at())}
                    >
                      {q.label}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <DateTimePicker
                    aria-label={`New date and time (${timezone})`}
                    value={draft}
                    onChange={setDraft}
                    uiSize="md"
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={update.isPending || draft === toZonedInput(eventInstant(a), timezone)}
                    onClick={() => {
                      const at = fromZonedInput(draft, timezone);
                      if (at) move(at);
                      else toast.error("Enter a valid date and time");
                    }}
                  >
                    Move
                  </Button>
                </div>
                <p className="text-[10px] text-foreground-subtle">Times are in {timezone}. You can also drag events on the calendar.</p>
              </div>
            ) : null}
          </div>
        ) : (
          <LoadingState compact />
        )}
        <ModalFooter className="flex-wrap gap-2">
          {ctx?.timelineHref ? (
            <Button asChild size="sm" variant="ghost">
              <Link href={ctx.timelineHref}>
                <ExternalLink className="size-3.5" />
                Timeline
              </Link>
            </Button>
          ) : null}
          {canCreate && a ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onScheduleNext(context);
              }}
            >
              <Plus className="size-3.5" />
              Follow-up
            </Button>
          ) : null}
          {editable ? (
            <Button size="sm" onClick={complete} disabled={update.isPending}>
              <Check className="size-3.5" />
              Mark complete
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
