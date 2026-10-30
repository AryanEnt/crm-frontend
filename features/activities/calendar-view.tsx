"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  LayoutList,
  Loader2,
  Plus,
  Square,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/error-state";
import { CalendarSkeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dayPickerClass } from "@/components/ui/date-picker";
import { DayPicker } from "react-day-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-provider";
import { ScopeFilterControls, useScopeFilters } from "@/features/teams/scope-filters";
import { crmApi, type Activity } from "@/lib/api/crm";
import {
  ActivityQuickCreateDialog,
  type ActivityContext,
} from "@/features/activities/activity-quick-create";
import { toDateTimeLocal } from "@/lib/forms/datetime";
import {
  addDays,
  addMonths,
  calendarDayKey,
  commonTimezones,
  dayKeyInTimezone,
  DEFAULT_TIMEZONE,
  startOfDayInTimezone,
  startOfMonth,
  startOfWeek,
  todayInTimezone,
} from "@/lib/timezone";
import { cn } from "@/lib/utils";
import { TimeGrid } from "./calendar-time-grid";
import { CalendarEventDialog } from "./calendar-event-dialog";
import { leadMovedMessage } from "./lead-moved";
import {
  colorOf,
  eventInstant,
  calendarEventLabel,
  formatClock,
  instantAt,
  isOpen,
  minutesInTimezone,
  relatedName,
  rescheduleFields,
  shortTitle,
  statusTone,
  typeDot,
  typeDotClass,
  useUpdateActivity,
} from "./calendar-utils";

type ViewMode = "month" | "week" | "day" | "agenda";

const VIEW_KEY = "aurora.calendar.view";
const VIEW_EVENT = "aurora-calendar-view";
const DEFAULT_CREATE_MINUTES = 9 * 60;
const AGENDA_DAYS = 14;
const STATUSES = ["upcoming", "due", "overdue", "completed", "cancelled"];

const viewOptions: Array<{ value: ViewMode; label: string; key: string; icon: typeof CalendarDays }> = [
  { value: "month", label: "Month", key: "M", icon: CalendarDays },
  { value: "week", label: "Week", key: "W", icon: CalendarRange },
  { value: "day", label: "Day", key: "D", icon: Square },
  { value: "agenda", label: "Agenda", key: "A", icon: LayoutList },
];

const isView = (v: string | null): v is ViewMode => viewOptions.some((o) => o.value === v);

function readView(): string | null {
  try {
    return window.localStorage.getItem(VIEW_KEY);
  } catch {
    return null;
  }
}

function subscribeView(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(VIEW_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(VIEW_EVENT, onChange);
  };
}

/** Last used layout, remembered in this browser. */
function useCalendarView(): [ViewMode, (v: ViewMode) => void] {
  const raw = React.useSyncExternalStore(subscribeView, readView, () => null);
  const setView = React.useCallback((v: ViewMode) => {
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event(VIEW_EVENT));
  }, []);
  return [isView(raw) ? raw : "month", setView];
}

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

function step(view: ViewMode, cursor: Date, dir: 1 | -1) {
  if (view === "month") return addMonths(cursor, dir);
  return addDays(cursor, dir * (view === "week" ? 7 : view === "agenda" ? AGENDA_DAYS : 1));
}

function CalendarViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const activeIndex = Math.max(0, viewOptions.findIndex((o) => o.value === value));
  return (
    <div
      role="radiogroup"
      aria-label="Calendar layout"
      className="relative isolate inline-flex h-9 shrink-0 items-center rounded-full border border-border bg-surface-muted p-[3px]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-[3px] w-[calc(25%-3px)] rounded-full bg-surface shadow-[0_2px_8px_rgba(64,58,143,0.12)] ring-1 ring-brand/20 transition-[left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ left: `calc(${activeIndex} * 25% + 3px)` }}
      />
      {viewOptions.map((option) => {
        const active = value === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-keyshortcuts={option.key}
            title={`${option.label} (${option.key})`}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 flex h-full min-w-[68px] flex-1 items-center justify-center gap-1 rounded-full px-2 text-[11px] font-semibold tracking-wide transition-colors duration-200",
              active ? "text-brand-dark" : "text-foreground-subtle hover:text-foreground-muted",
            )}
          >
            <Icon className={cn("size-3.5", active && "scale-110")} />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CalendarView() {
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const timezone = user?.timezone || DEFAULT_TIMEZONE;
  const canCreate = can("activities:create");
  const canEdit = can("activities:edit");
  const scopeFilters = useScopeFilters("activities:view");
  const scopeParams = scopeFilters.params;
  const update = useUpdateActivity();

  const [view, setView] = useCalendarView();
  const [cursor, setCursor] = React.useState(() => todayInTimezone(timezone));
  const [typeCode, setTypeCode] = React.useState("all");
  const [pipelineId, setPipelineId] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [create, setCreate] = React.useState<{ open: boolean; dueAt?: string; context?: ActivityContext }>({
    open: false,
  });
  const [selected, setSelected] = React.useState<Activity | null>(null);
  const [tzDraft, setTzDraft] = React.useState(timezone);
  const [jumpOpen, setJumpOpen] = React.useState(false);

  const range = React.useMemo(() => {
    if (view === "month") {
      const start = startOfWeek(startOfMonth(cursor));
      return { from: start, to: addDays(start, 42) };
    }
    if (view === "week") {
      const start = startOfWeek(cursor);
      return { from: start, to: addDays(start, 7) };
    }
    const start = new Date(cursor);
    start.setHours(0, 0, 0, 0);
    return { from: start, to: addDays(start, view === "day" ? 1 : AGENDA_DAYS) };
  }, [view, cursor]);

  const params = React.useMemo(() => {
    const p = new URLSearchParams({
      from: startOfDayInTimezone(range.from, timezone).toISOString(),
      to: startOfDayInTimezone(range.to, timezone).toISOString(),
      limit: "500",
    });
    for (const [key, value] of scopeParams) p.set(key, value);
    if (typeCode !== "all") p.set("type", typeCode);
    if (pipelineId !== "all") p.set("pipelineId", pipelineId);
    if (status !== "all") p.set("status", status);
    return p;
  }, [range, timezone, scopeParams, typeCode, pipelineId, status]);

  const calendarQuery = useQuery({
    queryKey: ["calendar", params.toString()],
    queryFn: () => crmApi.calendarActivities(params),
    placeholderData: (previous) => previous,
  });
  const typesQuery = useQuery({
    queryKey: ["activity-types"],
    queryFn: () => crmApi.listActivityTypes(),
  });
  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "calendar"],
    queryFn: () => crmApi.listPipelines(),
  });

  const events = React.useMemo(() => calendarQuery.data?.data ?? [], [calendarQuery.data?.data]);
  const byDay = React.useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of events) {
      const key = dayKeyInTimezone(eventInstant(a), timezone);
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((x, y) => +eventInstant(x) - +eventInstant(y));
    return map;
  }, [events, timezone]);

  const visibleTypes = React.useMemo(
    () => (typesQuery.data ?? []).filter((t) => t.isActive && !t.isSystem),
    [typesQuery.data],
  );

  const overdueCount = events.filter((e) => e.displayStatus === "overdue").length;
  const todayKey = dayKeyInTimezone(new Date(), timezone);
  const todayCount = byDay.get(todayKey)?.length ?? 0;
  const truncated = (calendarQuery.data?.total ?? 0) > events.length;

  const monthPrefix = calendarDayKey(cursor).slice(0, 7);
  const periodCount =
    view === "month"
      ? Array.from(byDay).reduce((n, [key, list]) => (key.startsWith(monthPrefix) ? n + list.length : n), 0)
      : events.length;
  const periodLabel =
    view === "month"
      ? "this month"
      : view === "week"
        ? "this week"
        : view === "day"
          ? periodCount === 1 ? "activity" : "activities"
          : `in the next ${AGENDA_DAYS} days`;
  const showingToday =
    calendarDayKey(range.from) <= todayKey && todayKey < calendarDayKey(range.to);

  const titleLabel = React.useMemo(() => {
    if (view === "month") {
      return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(cursor);
    }
    if (view === "day") {
      return new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(cursor);
    }
    const fmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
    return fmt.formatRange(range.from, addDays(range.to, -1));
  }, [cursor, view, range]);

  const filtersActive =
    scopeFilters.active || typeCode !== "all" || pipelineId !== "all" || status !== "all";

  const openCreate = React.useCallback(
    (day?: Date, minutes = DEFAULT_CREATE_MINUTES, context?: ActivityContext) => {
      setCreate({
        open: true,
        dueAt: day ? toDateTimeLocal(instantAt(day, minutes, timezone)) : undefined,
        context,
      });
    },
    [timezone],
  );

  const moveActivity = React.useCallback(
    (a: Activity, start: Date) => {
      update.mutate(
        { activity: a, fields: rescheduleFields(a, start) },
        {
          onSuccess: () =>
            toast.success(`Moved “${a.title}”`, {
              description: new Intl.DateTimeFormat(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZone: timezone,
              }).format(start),
            }),
        },
      );
    },
    [update, timezone],
  );

  const goToday = React.useCallback(() => setCursor(todayInTimezone(timezone)), [timezone]);
  const openDay = React.useCallback(
    (d: Date) => {
      setCursor(d);
      setView("day");
    },
    [setView],
  );

  const dialogOpen = create.open || selected !== null;
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (dialogOpen || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) return;
      const key = event.key.toLowerCase();
      const option = viewOptions.find((o) => o.key.toLowerCase() === key);
      if (option) setView(option.value);
      else if (key === "t") goToday();
      else if (key === "arrowleft" || key === "p") setCursor((c) => step(view, c, -1));
      else if (key === "arrowright" || key === "n") setCursor((c) => step(view, c, 1));
      else if (key === "c" && canCreate) openCreate(view === "day" ? cursor : undefined);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialogOpen, view, cursor, canCreate, setView, goToday, openCreate]);

  if (calendarQuery.isError && !calendarQuery.data) {
    return <ErrorState onRetry={() => void calendarQuery.refetch()} />;
  }

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Calendar" }]}
        title="Calendar"
        description="Plan follow-ups and meetings"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canCreate ? (
              <Button size="sm" onClick={() => openCreate()} title="New activity (C)">
                <Plus className="size-3.5" />
                Activity
              </Button>
            ) : null}
            <Select
              value={tzDraft}
              onValueChange={(tz) => {
                setTzDraft(tz);
                void crmApi.setTimezone(tz).then(() => {
                  void qc.invalidateQueries({ queryKey: ["auth"] });
                  window.location.reload();
                });
              }}
            >
              <SelectTrigger className="w-[180px]" aria-label="Timezone">
                <Clock3 className="size-3.5 text-foreground-muted" />
                <SelectValue placeholder="Timezone" />
              </SelectTrigger>
              <SelectContent>
                {commonTimezones().map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 shadow-[0_1px_0_rgba(42,40,56,0.04)] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Previous"
              title="Previous (←)"
              onClick={() => setCursor((c) => step(view, c, -1))}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              size="sm"
              variant={showingToday ? "secondary" : "outline"}
              className="h-7 px-2.5"
              title="Today (T)"
              onClick={goToday}
            >
              Today
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Next"
              title="Next (→)"
              onClick={() => setCursor((c) => step(view, c, 1))}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>

          <Popover modal open={jumpOpen} onOpenChange={setJumpOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                title="Jump to a date"
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[15px] font-semibold tracking-tight text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {titleLabel}
                <ChevronDown className="size-3.5 text-foreground-muted" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <DayPicker
                mode="single"
                selected={cursor}
                defaultMonth={cursor}
                onSelect={(day) => {
                  if (!day) return;
                  setCursor(day);
                  setJumpOpen(false);
                }}
                className={dayPickerClass}
              />
            </PopoverContent>
          </Popover>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="px-1 tabular-nums text-foreground-muted">
              {periodCount} {periodLabel}
            </span>
            {showingToday ? (
              <button
                type="button"
                title="Open today in Day view"
                onClick={() => openDay(todayInTimezone(timezone))}
                className="inline-flex items-center gap-1 rounded-full border border-brand-border bg-brand-soft px-2 py-0.5 font-medium text-brand-dark transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {todayCount} today
                <ArrowRight aria-hidden className="size-3" />
              </button>
            ) : null}
            {overdueCount > 0 ? (
              <button
                type="button"
                aria-pressed={status === "overdue"}
                title={status === "overdue" ? "Show all statuses" : "Show only overdue"}
                onClick={() => setStatus((s) => (s === "overdue" ? "all" : "overdue"))}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  status === "overdue"
                    ? "border-danger bg-danger text-white"
                    : "border-danger-border bg-danger-soft text-danger hover:border-danger",
                )}
              >
                <CircleAlert aria-hidden className="size-3" />
                {overdueCount} overdue
              </button>
            ) : null}
            {truncated ? (
              <span className="px-1 text-warning">
                Showing the first {events.length} of {calendarQuery.data?.total} · narrow the filters to see the rest
              </span>
            ) : null}
            {calendarQuery.isFetching && !calendarQuery.isLoading ? (
              <Loader2 aria-label="Updating" className="size-3.5 animate-spin text-foreground-subtle" />
            ) : null}
          </div>
        </div>
        <CalendarViewToggle value={view} onChange={setView} />
      </div>

      <FilterBar
        onClear={
          filtersActive
            ? () => {
                scopeFilters.reset();
                setTypeCode("all");
                setPipelineId("all");
                setStatus("all");
              }
            : undefined
        }
      >
        <ScopeFilterControls filters={scopeFilters} />
        <Select value={pipelineId} onValueChange={setPipelineId}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Pipeline" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All pipelines</SelectItem>
            {(pipelinesQuery.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                <span className="capitalize">{s}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {visibleTypes.length > 0 ? (
        <div role="group" aria-label="Filter by activity type" className="flex flex-wrap items-center gap-1.5">
          <TypeChip active={typeCode === "all"} onClick={() => setTypeCode("all")}>
            All types
          </TypeChip>
          {visibleTypes.map((t) => (
            <TypeChip
              key={t.id}
              active={typeCode === t.code}
              dotClass={typeDotClass(t.code, t.color)}
              onClick={() => setTypeCode((c) => (c === t.code ? "all" : t.code))}
            >
              {t.name}
            </TypeChip>
          ))}
        </div>
      ) : null}

      {calendarQuery.isLoading ? (
        <CalendarSkeleton />
      ) : view === "month" ? (
        <MonthGrid
          cursor={cursor}
          timezone={timezone}
          byDay={byDay}
          onSelect={setSelected}
          onDayOpen={openDay}
          onDayCreate={canCreate ? (d) => openCreate(d) : undefined}
          onMove={canEdit ? moveActivity : undefined}
        />
      ) : view === "agenda" ? (
        <AgendaList
          events={events}
          timezone={timezone}
          canEdit={canEdit}
          onSelect={setSelected}
          onDayOpen={openDay}
          onCreate={canCreate ? () => openCreate() : undefined}
        />
      ) : (
        <TimeGrid
          days={
            view === "day"
              ? [cursor]
              : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))
          }
          timezone={timezone}
          byDay={byDay}
          onSelect={setSelected}
          onCreateAt={canCreate ? (d, minutes) => openCreate(d, minutes) : undefined}
          onMove={canEdit ? moveActivity : undefined}
          onDayOpen={openDay}
        />
      )}

      <p className="hidden flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground-subtle md:flex">
        {canCreate ? <span>Click an empty slot to add an activity.</span> : null}
        {canEdit ? <span>Drag an event to reschedule it.</span> : null}
        <span>
          Shortcuts: <Kbd>T</Kbd> today · <Kbd>←</Kbd> <Kbd>→</Kbd> move · <Kbd>M</Kbd> <Kbd>W</Kbd> <Kbd>D</Kbd>{" "}
          <Kbd>A</Kbd> views{canCreate ? <> · <Kbd>C</Kbd> new</> : null}
        </span>
        <span className="ml-auto">Times in {timezone}</span>
      </p>

      <ActivityQuickCreateDialog
        open={create.open}
        onOpenChange={(open) => setCreate((c) => ({ ...c, open }))}
        context={create.context}
        defaultDueAt={create.dueAt}
        onCreated={() => void qc.invalidateQueries({ queryKey: ["calendar"] })}
      />

      <CalendarEventDialog
        activity={selected}
        timezone={timezone}
        canEdit={canEdit}
        canCreate={canCreate}
        onOpenChange={(o) => !o && setSelected(null)}
        onScheduleNext={(context) => openCreate(undefined, DEFAULT_CREATE_MINUTES, context)}
      />
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-surface px-1 font-sans text-[10px] font-medium text-foreground-muted">
      {children}
    </kbd>
  );
}

function TypeChip({
  active,
  dotClass,
  onClick,
  children,
}: {
  active: boolean;
  dotClass?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
        active
          ? "border-brand/40 bg-brand-soft text-brand-dark"
          : "border-border bg-surface text-foreground-muted hover:border-border-strong hover:text-foreground",
      )}
    >
      {dotClass ? <span className={cn("size-2 rounded-full", dotClass)} /> : null}
      {children}
    </button>
  );
}

const MONTH_VISIBLE = 3;

const STATUS_LABEL: Record<string, string> = {
  overdue: "Overdue",
  completed: "Completed",
  cancelled: "Cancelled",
  due: "Due soon",
  upcoming: "Upcoming",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "overdue") return <CircleAlert aria-hidden className="size-3 shrink-0 text-danger" />;
  if (status === "completed") return <Check aria-hidden strokeWidth={3} className="size-3 shrink-0 text-success" />;
  if (status === "cancelled") return <X aria-hidden className="size-3 shrink-0 text-foreground-subtle" />;
  return null;
}

/** One line: type dot, status, time, short title · lead. Status by icon/colour, never strikethrough. */
function EventChip({
  activity: a,
  timezone,
  roomy = false,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"button"> & { activity: Activity; timezone: string; roomy?: boolean }) {
  const status = a.displayStatus;
  const time = formatClock(minutesInTimezone(eventInstant(a), timezone));
  const label = STATUS_LABEL[status] ?? status;
  const chip = calendarEventLabel(a);
  const related = relatedName(a);
  return (
    <button
      type="button"
      title={`${a.title}${related ? ` · ${related}` : ""} · ${label} · ${time}`}
      aria-label={`${chip}, ${label}, ${time}`}
      className={cn(
        "flex w-full min-w-0 items-center gap-1 rounded-sm px-1 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        roomy ? "py-1 text-xs" : "py-px text-[11px] leading-4",
        className,
      )}
      {...props}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", typeDotClass(a.kind, a.typeColor))} />
      <StatusIcon status={status} />
      <span
        className={cn(
          "shrink-0 tabular-nums",
          !roomy && "hidden sm:inline",
          status === "overdue"
            ? "font-medium text-danger"
            : isOpen(a)
              ? "text-foreground-muted"
              : "text-foreground-subtle",
        )}
      >
        {time}
      </span>
      <span
        className={cn(
          "min-w-0 truncate",
          status === "completed"
            ? "text-foreground-muted"
            : status === "cancelled"
              ? "text-foreground-subtle"
              : "text-foreground",
        )}
      >
        <span className="font-medium">{shortTitle(a.title)}</span>
        {related ? <span className="text-foreground-muted"> · {related}</span> : null}
      </span>
    </button>
  );
}

/** Every activity on a day, so a crowded cell never hides anything. */
function DayEventsPopover({
  day,
  items,
  hidden,
  timezone,
  onSelect,
  onDayOpen,
  onDayCreate,
}: {
  day: Date;
  items: Activity[];
  hidden: number;
  timezone: string;
  onSelect: (a: Activity) => void;
  onDayOpen: (d: Date) => void;
  onDayCreate?: (d: Date) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(day);
  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Show all ${items.length} activities on ${dayLabel}`}
          className="rounded-sm px-1 text-[11px] text-foreground-muted underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          +{hidden} more
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline justify-between gap-2 border-b border-line px-3 py-2">
          <p className="truncate text-xs font-semibold text-foreground">{dayLabel}</p>
          <span className="shrink-0 text-[11px] tabular-nums text-foreground-subtle">
            {items.length} activities
          </span>
        </div>
        <ul className="max-h-72 overflow-y-auto p-1">
          {items.map((a) => (
            <li key={a.id}>
              <EventChip activity={a} timezone={timezone} roomy onClick={act(() => onSelect(a))} />
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-line px-3 py-1.5">
          <button
            type="button"
            onClick={act(() => onDayOpen(day))}
            className="text-xs font-medium text-brand-dark hover:underline"
          >
            Open day view
          </button>
          {onDayCreate ? (
            <button
              type="button"
              onClick={act(() => onDayCreate(day))}
              className="inline-flex items-center gap-1 text-xs font-medium text-foreground-muted hover:text-foreground"
            >
              <Plus className="size-3" />
              Add
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MonthGrid({
  cursor,
  timezone,
  byDay,
  onSelect,
  onDayOpen,
  onDayCreate,
  onMove,
}: {
  cursor: Date;
  timezone: string;
  byDay: Map<string, Activity[]>;
  onSelect: (a: Activity) => void;
  onDayOpen: (d: Date) => void;
  onDayCreate?: (d: Date) => void;
  onMove?: (a: Activity, start: Date) => void;
}) {
  const start = startOfWeek(startOfMonth(cursor));
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const month = cursor.getMonth();
  const todayKey = dayKeyInTimezone(new Date(), timezone);
  const dragRef = React.useRef<Activity | null>(null);
  const [dropKey, setDropKey] = React.useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line text-label text-foreground-muted">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-2 text-center font-semibold tracking-wide">
            <span className="sm:hidden">{d.slice(0, 1)}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((d) => {
          const key = calendarDayKey(d);
          const items = byDay.get(key) ?? [];
          const inMonth = d.getMonth() === month;
          const isToday = key === todayKey;
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const overflow = items.length - MONTH_VISIBLE;
          return (
            <div
              key={key}
              className={cn(
                "group relative min-h-[96px] border-b border-r border-line p-1 transition-colors sm:min-h-[118px]",
                "[&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0",
                !inMonth && "bg-surface-muted/40",
                inMonth && isWeekend && "bg-surface-muted/20",
                onDayCreate && "cursor-pointer hover:bg-surface-muted/60",
                dropKey === key && "bg-brand-soft/60 ring-2 ring-inset ring-brand/50",
              )}
              onClick={(event) => {
                if (!onDayCreate || (event.target as HTMLElement).closest("button")) return;
                onDayCreate(d);
              }}
              onDragOver={(event) => {
                if (!dragRef.current || !onMove) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                if (dropKey !== key) setDropKey(key);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropKey(null);
              }}
              onDrop={(event) => {
                const a = dragRef.current;
                if (!a || !onMove) return;
                event.preventDefault();
                dragRef.current = null;
                setDropKey(null);
                if (dayKeyInTimezone(eventInstant(a), timezone) === key) return;
                onMove(a, instantAt(d, minutesInTimezone(eventInstant(a), timezone), timezone));
              }}
            >
              <div className="mb-0.5 flex items-center justify-between gap-1">
                <button
                  type="button"
                  title="Open day"
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[12px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isToday
                      ? "bg-brand font-semibold text-primary-foreground hover:bg-brand-hover"
                      : "font-medium text-foreground hover:bg-surface-muted",
                    !inMonth && !isToday && "text-foreground-subtle",
                  )}
                  onClick={() => onDayOpen(d)}
                >
                  {d.getDate()}
                </button>
                {onDayCreate ? (
                  <button
                    type="button"
                    title="Add activity"
                    className="flex size-6 items-center justify-center rounded-md text-foreground-muted opacity-0 transition-opacity hover:bg-surface hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 group-focus-within:opacity-100"
                    aria-label={`Add activity on ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d)}`}
                    onClick={() => onDayCreate(d)}
                  >
                    <Plus className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <ul className="space-y-px">
                {items.slice(0, overflow > 0 ? MONTH_VISIBLE - 1 : MONTH_VISIBLE).map((a) => {
                  const draggable = Boolean(onMove) && isOpen(a);
                  return (
                    <li key={a.id}>
                      <EventChip
                        activity={a}
                        timezone={timezone}
                        draggable={draggable}
                        onDragStart={(event) => {
                          dragRef.current = a;
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", a.id);
                        }}
                        onDragEnd={() => {
                          dragRef.current = null;
                          setDropKey(null);
                        }}
                        className={cn(draggable && "cursor-grab active:cursor-grabbing")}
                        onClick={() => onSelect(a)}
                      />
                    </li>
                  );
                })}
                {overflow > 0 ? (
                  <li>
                    <DayEventsPopover
                      day={d}
                      items={items}
                      hidden={overflow + 1}
                      timezone={timezone}
                      onSelect={onSelect}
                      onDayOpen={onDayOpen}
                      onDayCreate={onDayCreate}
                    />
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaList({
  events,
  timezone,
  canEdit,
  onSelect,
  onDayOpen,
  onCreate,
}: {
  events: Activity[];
  timezone: string;
  canEdit: boolean;
  onSelect: (a: Activity) => void;
  onDayOpen: (d: Date) => void;
  onCreate?: () => void;
}) {
  const update = useUpdateActivity();
  const groups = React.useMemo(() => {
    const sorted = events.slice().sort((a, b) => +eventInstant(a) - +eventInstant(b));
    const map = new Map<string, Activity[]>();
    for (const a of sorted) {
      const key = dayKeyInTimezone(eventInstant(a), timezone);
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [events, timezone]);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-14 text-center">
        <CalendarDays className="mx-auto size-8 text-foreground-subtle" />
        <p className="mt-3 text-sm font-medium text-foreground">Nothing scheduled</p>
        <p className="mt-1 text-xs text-foreground-muted">
          No activities in the next {AGENDA_DAYS} days. Move ahead or clear filters.
        </p>
        {onCreate ? (
          <Button size="sm" className="mt-4" onClick={onCreate}>
            <Plus className="size-3.5" />
            New activity
          </Button>
        ) : null}
      </div>
    );
  }

  const todayKey = dayKeyInTimezone(new Date(), timezone);

  return (
    <div className="space-y-3">
      {groups.map(([day, items]) => {
        const [y, m, d] = day.split("-").map(Number);
        return (
          <section
            key={day}
            className={cn(
              "overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_0_rgba(42,40,56,0.04)]",
              day === todayKey && "ring-1 ring-brand/20",
            )}
          >
            <div className="flex items-center justify-between border-b border-border bg-surface-muted/50 px-3 py-2">
              <button
                type="button"
                onClick={() => onDayOpen(new Date(y, m - 1, d))}
                className="text-xs font-semibold text-foreground hover:text-brand-dark"
              >
                {new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(
                  new Date(y, m - 1, d),
                )}
                {day === todayKey ? (
                  <span className="ml-2 rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-brand-dark">
                    Today
                  </span>
                ) : null}
              </button>
              <span className="text-[11px] text-foreground-subtle">
                {items.length} item{items.length === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="divide-y divide-border">
              {items.map((a) => {
                const open = isOpen(a);
                return (
                  <li key={a.id} className="flex items-start gap-2 px-3 py-2.5 transition-colors hover:bg-brand-soft/30">
                    {canEdit && open ? (
                      <button
                        type="button"
                        aria-label={`Mark “${a.title}” complete`}
                        title="Mark complete"
                        disabled={update.isPending}
                        onClick={() =>
                          update.mutate(
                            { activity: a, fields: { status: "completed", displayStatus: "completed" } },
                            {
                              onSuccess: (result) =>
                                toast.success("Marked complete", { description: leadMovedMessage(result) }),
                            },
                          )
                        }
                        className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong text-transparent transition-colors hover:border-success hover:bg-success/10 hover:text-success"
                      >
                        <Check className="size-2.5" strokeWidth={3} />
                      </button>
                    ) : (
                      <span
                        className={cn(
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
                          a.status === "completed" ? "bg-success/15 text-success" : "",
                        )}
                      >
                        {a.status === "completed" ? <Check className="size-2.5" strokeWidth={3} /> : null}
                      </span>
                    )}
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
                      onClick={() => onSelect(a)}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("size-2 shrink-0 rounded-full", colorOf(typeDot, a.typeColor))} />
                          <p className={cn("truncate text-sm font-medium", !open && "text-foreground-muted line-through")}>
                            {shortTitle(a.title)}
                            {relatedName(a) ? (
                              <span className="font-normal text-foreground-muted"> · {relatedName(a)}</span>
                            ) : null}
                          </p>
                        </div>
                        <p className="mt-0.5 truncate pl-4 text-xs text-foreground-muted">
                          {a.typeName ?? a.kind}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs tabular-nums text-foreground-muted">
                          {formatClock(minutesInTimezone(eventInstant(a), timezone))}
                        </p>
                        <StatusBadge tone={statusTone(a.displayStatus)} className="mt-1">
                          {a.displayStatus}
                        </StatusBadge>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
