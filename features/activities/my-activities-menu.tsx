"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Check } from "lucide-react";
import { IconButton } from "@/components/ui/console/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/console/dropdown-menu";
import { useAuth } from "@/features/auth/auth-provider";
import { activityHref } from "@/features/activities/activity-href";
import {
  eventInstant,
  formatClock,
  minutesInTimezone,
  typeDotClass,
  useUpdateActivity,
} from "@/features/activities/calendar-utils";
import { leadMovedMessage } from "@/features/activities/lead-moved";
import { groupMyActivities } from "@/features/activities/my-activities";
import { crmApi, type Activity } from "@/lib/api/crm";
import { formatRelative } from "@/lib/relative-time";
import {
  addDays,
  calendarDayKey,
  dayKeyInTimezone,
  DEFAULT_TIMEZONE,
  startOfDayInTimezone,
  todayInTimezone,
} from "@/lib/timezone";
import { cn } from "@/lib/utils";

const REFRESH_MS = 60_000;
const UPCOMING_DAYS = 7;
const MAX_PER_GROUP = 5;

const related = (a: Activity) => a.leadName || a.dealTitle || a.customerName || "";
const joinDetail = (...parts: string[]) => parts.filter(Boolean).join(" · ");

/** The signed-in user's open activities: overdue, the rest of today, and the next week. */
export function MyActivitiesMenu() {
  const { user, can } = useAuth();
  const router = useRouter();
  const update = useUpdateActivity();
  const userId = user?.id ?? "";
  const timezone = user?.timezone || DEFAULT_TIMEZONE;
  const enabled = Boolean(userId) && can("activities:view");
  const canEdit = can("activities:edit");
  const [done, setDone] = React.useState<ReadonlySet<string>>(new Set());

  const todayKey = dayKeyInTimezone(new Date(), timezone);
  const tomorrowKey = calendarDayKey(addDays(todayInTimezone(timezone), 1));

  // Same key and request as the bell, so both icons share one fetch.
  const overdueQuery = useQuery({
    queryKey: ["notifications", "overdue", userId],
    queryFn: () =>
      crmApi.listActivities(
        new URLSearchParams({ status: "overdue", ownerUserId: userId, limit: "20", offset: "0" }),
      ),
    enabled,
    refetchInterval: REFRESH_MS,
  });
  const scheduledQuery = useQuery({
    queryKey: ["calendar", "mine", userId, timezone, todayKey],
    queryFn: () => {
      const today = todayInTimezone(timezone);
      return crmApi.calendarActivities(
        new URLSearchParams({
          from: startOfDayInTimezone(today, timezone).toISOString(),
          to: startOfDayInTimezone(addDays(today, UPCOMING_DAYS), timezone).toISOString(),
          status: "upcoming",
          ownerUserId: userId,
          limit: "100",
        }),
      );
    },
    enabled,
    refetchInterval: REFRESH_MS,
  });

  const groups = React.useMemo(
    () =>
      groupMyActivities(
        overdueQuery.data?.data ?? [],
        scheduledQuery.data?.data ?? [],
        (a) => dayKeyInTimezone(eventInstant(a), timezone),
        todayKey,
        done,
      ),
    [overdueQuery.data, scheduledQuery.data, timezone, todayKey, done],
  );

  const now = overdueQuery.dataUpdatedAt;
  const overdueCount = Math.max(groups.overdue.length, (overdueQuery.data?.total ?? 0) - done.size);
  const badge = overdueCount + groups.today.length;
  const empty = groups.overdue.length + groups.today.length + groups.upcoming.length === 0;
  const loading = enabled && (overdueQuery.isPending || scheduledQuery.isPending);

  const clock = (a: Activity) => formatClock(minutesInTimezone(eventInstant(a), timezone));
  const dayLabel = (a: Activity) => {
    const key = dayKeyInTimezone(eventInstant(a), timezone);
    if (key === tomorrowKey) return "Tomorrow";
    return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: timezone })
      .format(eventInstant(a));
  };

  const complete = (a: Activity) => {
    setDone((prev) => new Set(prev).add(a.id));
    update.mutate(
      { activity: a, fields: { status: "completed", displayStatus: "completed" } },
      {
        onSuccess: (result) => toast.success("Marked complete", { description: leadMovedMessage(result) }),
        onError: () =>
          setDone((prev) => {
            const next = new Set(prev);
            next.delete(a.id);
            return next;
          }),
      },
    );
  };

  const section = (label: string, items: Activity[], total: number, detail: (a: Activity) => string, urgent = false) =>
    items.length === 0 ? null : (
      <div role="group" aria-label={label}>
        <div className="flex items-center justify-between px-2 pb-0.5 pt-1.5">
          <span className={cn("text-overline", urgent ? "text-danger" : "text-ink-muted")}>{label}</span>
          <span className="text-caption tabular-nums text-ink-muted">{total}</span>
        </div>
        {items.slice(0, MAX_PER_GROUP).map((a) => (
          <div key={a.id} className="flex items-center gap-0.5">
            <DropdownMenuItem
              onSelect={() => router.push(activityHref(a))}
              className="h-auto min-w-0 flex-1 py-1.5"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={cn("size-2 shrink-0 rounded-full", typeDotClass(a.kind, a.typeColor))} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{a.title}</span>
                  <span className={cn("block truncate text-caption", urgent ? "text-danger" : "text-ink-muted")}>
                    {detail(a)}
                  </span>
                </span>
              </span>
            </DropdownMenuItem>
            {canEdit ? (
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-label={`Mark “${a.title}” complete`}
                title="Mark complete"
                onClick={() => complete(a)}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-muted outline-none transition-colors hover:bg-success-soft hover:text-success focus:bg-success-soft focus:text-success"
              >
                <Check aria-hidden className="size-4" />
              </button>
            ) : null}
          </div>
        ))}
        {total > MAX_PER_GROUP ? (
          <p className="px-2 pb-1 text-caption text-ink-muted">+{total - MAX_PER_GROUP} more</p>
        ) : null}
      </div>
    );

  if (!enabled) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <IconButton
          label={
            badge > 0
              ? `My activities, ${overdueCount} overdue, ${groups.today.length} today`
              : "My activities"
          }
          tooltip={false}
          className="relative"
        >
          <CalendarClock />
          {badge > 0 ? (
            <span
              aria-hidden
              className={cn(
                "absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none tabular-nums",
                overdueCount > 0 ? "bg-danger text-white" : "bg-ink-secondary text-surface",
              )}
            >
              {badge > 9 ? "9+" : badge}
            </span>
          ) : null}
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label="My activities" className="max-h-[70vh] w-80 overflow-y-auto">
        <div className="px-2 pb-1 pt-1.5">
          <span className="text-overline text-ink-muted">My activities</span>
        </div>
        <DropdownMenuSeparator />
        {empty ? (
          <p className="px-2 py-3 text-center text-caption text-ink-muted">
            {loading ? "Loading…" : `Nothing open for the next ${UPCOMING_DAYS} days.`}
          </p>
        ) : (
          <>
            {section(
              "Overdue",
              groups.overdue,
              overdueCount,
              (a) => joinDetail(a.dueAt ? `Due ${formatRelative(a.dueAt, now)}` : "Overdue", related(a)),
              true,
            )}
            {section("Today", groups.today, groups.today.length, (a) => joinDetail(clock(a), related(a)))}
            {section("Next 7 days", groups.upcoming, groups.upcoming.length, (a) =>
              joinDetail(`${dayLabel(a)} ${clock(a)}`, related(a)),
            )}
          </>
        )}
        <DropdownMenuSeparator />
        <div className="flex items-center gap-1">
          <DropdownMenuItem onSelect={() => router.push("/calendar")} className="justify-center text-caption text-ink-secondary">
            Open calendar
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => router.push("/activities")}
            className="justify-center text-caption text-ink-secondary"
          >
            All activities
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
