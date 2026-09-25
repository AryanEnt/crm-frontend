"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LayoutList,
  Plus,
  Square,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/error-state";
import { CalendarSkeleton } from "@/components/ui/skeleton";
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
import { useAuth } from "@/features/auth/auth-provider";
import { adminApi } from "@/lib/api/admin";
import { crmApi, type Activity } from "@/lib/api/crm";
import { ActivityQuickCreateDialog } from "@/features/activities/activity-quick-create";
import {
  addDays,
  addMonths,
  commonTimezones,
  dayKeyInTimezone,
  formatDateInTimezone,
  formatInTimezone,
  formatTimeInTimezone,
  startOfMonth,
  startOfWeek,
} from "@/lib/timezone";
import { cn } from "@/lib/utils";

type ViewMode = "month" | "week" | "day" | "agenda";

const statusTone = (s: string) =>
  s === "overdue"
    ? "warning"
    : s === "completed"
      ? "success"
      : s === "cancelled"
        ? "neutral"
        : s === "due"
          ? "brand"
          : "info";

const typeDot: Record<string, string> = {
  slate: "bg-foreground-muted",
  blue: "bg-info",
  teal: "bg-brand",
  green: "bg-success",
  amber: "bg-warning",
  orange: "bg-warning",
  rose: "bg-destructive",
  violet: "bg-brand",
  neutral: "bg-foreground-subtle",
};

const typeChip: Record<string, string> = {
  slate: "bg-surface-muted text-foreground-muted",
  blue: "bg-info/15 text-info",
  teal: "bg-brand-soft text-brand-dark",
  green: "bg-success/15 text-success",
  amber: "bg-warning/15 text-warning",
  orange: "bg-warning/15 text-warning",
  rose: "bg-destructive/10 text-destructive",
  violet: "bg-brand-soft text-brand-dark",
  neutral: "bg-surface-muted text-foreground-muted",
};

const viewOptions: Array<{
  value: ViewMode;
  label: string;
  icon: typeof CalendarDays;
}> = [
  { value: "month", label: "Month", icon: CalendarDays },
  { value: "week", label: "Week", icon: CalendarRange },
  { value: "day", label: "Day", icon: Square },
  { value: "agenda", label: "Agenda", icon: LayoutList },
];

function eventInstant(a: Activity): Date {
  const raw = a.startAt || a.dueAt || a.createdAt;
  return new Date(raw);
}

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CalendarViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const activeIndex = Math.max(
    0,
    viewOptions.findIndex((o) => o.value === value),
  );
  return (
    <div
      role="radiogroup"
      aria-label="Calendar layout"
      className="relative isolate inline-flex h-9 shrink-0 items-center rounded-full border border-border bg-surface-muted p-[3px]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-[3px] w-[calc(25%-3px)] rounded-full bg-white shadow-[0_2px_8px_rgba(64,58,143,0.12)] ring-1 ring-brand/20 transition-[left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
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
            title={option.label}
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
  const timezone = user?.timezone || "UTC";
  const role = user?.roleCode;
  const isAdmin = role === "super_admin";
  const isTeamLead = role === "sales_manager";
  const isOwnOnly = role === "sales_executive" || role === "sales_support";
  const teamIdForScope = user?.teamIds?.[0];

  const [view, setView] = React.useState<ViewMode>("month");
  const [cursor, setCursor] = React.useState(() => new Date());
  const [ownerUserId, setOwnerUserId] = React.useState(isOwnOnly && user?.id ? user.id : "all");
  const [teamId, setTeamId] = React.useState("all");
  const [typeCode, setTypeCode] = React.useState("all");
  const [pipelineId, setPipelineId] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createDueAt, setCreateDueAt] = React.useState<string | undefined>();
  const [selected, setSelected] = React.useState<Activity | null>(null);
  const [tzDraft, setTzDraft] = React.useState(timezone);

  React.useEffect(() => {
    if (isOwnOnly && user?.id) {
      setOwnerUserId(user.id);
    }
  }, [isOwnOnly, user?.id]);

  const range = React.useMemo(() => {
    if (view === "month") {
      const start = startOfWeek(startOfMonth(cursor));
      const end = addDays(start, 42);
      return { from: start, to: end };
    }
    if (view === "week") {
      const start = startOfWeek(cursor);
      return { from: start, to: addDays(start, 7) };
    }
    if (view === "day") {
      const start = new Date(cursor);
      start.setHours(0, 0, 0, 0);
      return { from: start, to: addDays(start, 1) };
    }
    const start = new Date(cursor);
    start.setHours(0, 0, 0, 0);
    return { from: start, to: addDays(start, 14) };
  }, [view, cursor]);

  const params = React.useMemo(() => {
    const p = new URLSearchParams({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      limit: "500",
    });
    if (isOwnOnly && user?.id) {
      p.set("ownerUserId", user.id);
    } else if (ownerUserId !== "all") {
      p.set("ownerUserId", ownerUserId);
    }
    if (!isOwnOnly && teamId !== "all") p.set("teamId", teamId);
    if (typeCode !== "all") p.set("type", typeCode);
    if (pipelineId !== "all") p.set("pipelineId", pipelineId);
    if (status !== "all") p.set("status", status);
    return p;
  }, [range, ownerUserId, teamId, typeCode, pipelineId, status, isOwnOnly, user?.id]);

  const calendarQuery = useQuery({
    queryKey: ["calendar", params.toString()],
    queryFn: () => crmApi.calendarActivities(params),
  });
  const typesQuery = useQuery({
    queryKey: ["activity-types"],
    queryFn: () => crmApi.listActivityTypes(),
  });
  const usersQuery = useQuery({
    queryKey: ["users", "calendar", isAdmin ? "org" : "team", teamIdForScope],
    enabled: (isAdmin || isTeamLead) && can("users:view"),
    queryFn: () => {
      const p = new URLSearchParams({ limit: "100", isActive: "true" });
      if (isTeamLead && teamIdForScope) p.set("teamId", teamIdForScope);
      return adminApi.listUsers(p);
    },
  });
  const teamsQuery = useQuery({
    queryKey: ["teams", "calendar"],
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled: isAdmin && can("teams:view"),
  });
  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "calendar"],
    queryFn: () => crmApi.listPipelines("sales"),
  });

  const ownerOptions = React.useMemo(() => {
    const rows = usersQuery.data?.data ?? [];
    if (isAdmin || isTeamLead) return rows;
    return user ? [{ id: user.id, fullName: user.fullName }] : [];
  }, [usersQuery.data?.data, isAdmin, isTeamLead, user]);

  const events = React.useMemo(
    () => calendarQuery.data?.data ?? [],
    [calendarQuery.data?.data],
  );
  const byDay = React.useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of events) {
      const key = dayKeyInTimezone(eventInstant(a), timezone);
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return map;
  }, [events, timezone]);

  const overdueCount = React.useMemo(
    () => events.filter((e) => e.displayStatus === "overdue").length,
    [events],
  );
  const todayKey = dayKeyInTimezone(new Date(), timezone);
  const todayCount = byDay.get(todayKey)?.length ?? 0;

  const titleLabel = React.useMemo(() => {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      month: "long",
      year: "numeric",
      ...(view === "day" || view === "week" ? { day: "numeric" } : {}),
      ...(view === "week" ? { weekday: "short" } : {}),
    }).format(cursor);
  }, [cursor, timezone, view]);

  const filtersActive =
    (!isOwnOnly && ownerUserId !== "all") ||
    teamId !== "all" ||
    typeCode !== "all" ||
    pipelineId !== "all" ||
    status !== "all";

  const openCreateForDay = (d: Date) => {
    const local = new Date(d);
    local.setHours(9, 0, 0, 0);
    setCreateDueAt(toDatetimeLocalValue(local));
    setCreateOpen(true);
  };

  if (calendarQuery.isError) {
    return <ErrorState onRetry={() => void calendarQuery.refetch()} />;
  }

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Calendar" }]}
        title="Calendar"
        description={`Plan follow-ups and meetings · ${timezone}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
              <SelectTrigger className="w-[180px]">
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
            {can("activities:create") ? (
              <Button
                size="sm"
                onClick={() => {
                  setCreateDueAt(undefined);
                  setCreateOpen(true);
                }}
              >
                <Plus className="size-3.5" />
                Activity
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 shadow-[0_1px_0_rgba(42,40,56,0.04)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Previous"
              onClick={() =>
                setCursor((c) =>
                  view === "month"
                    ? addMonths(c, -1)
                    : addDays(c, view === "week" ? -7 : view === "agenda" ? -14 : -1),
                )
              }
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2.5" onClick={() => setCursor(new Date())}>
              Today
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Next"
              onClick={() =>
                setCursor((c) =>
                  view === "month"
                    ? addMonths(c, 1)
                    : addDays(c, view === "week" ? 7 : view === "agenda" ? 14 : 1),
                )
              }
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">
              {titleLabel}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-foreground-muted">
              <span>
                {events.length} event{events.length === 1 ? "" : "s"}
              </span>
              <span className="text-foreground-subtle">·</span>
              <span>{todayCount} today</span>
              {overdueCount > 0 ? (
                <>
                  <span className="text-foreground-subtle">·</span>
                  <span className="font-medium text-warning">{overdueCount} overdue</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <CalendarViewToggle value={view} onChange={setView} />
      </div>

      <FilterBar
        onClear={
          filtersActive
            ? () => {
                if (!isOwnOnly) setOwnerUserId("all");
                setTeamId("all");
                setTypeCode("all");
                setPipelineId("all");
                setStatus("all");
              }
            : undefined
        }
      >
        {isOwnOnly ? (
          <div className="flex h-8 items-center rounded-md border border-border bg-surface-muted/50 px-2.5 text-xs text-foreground-muted">
            Owner: {user?.fullName ?? "You"}
          </div>
        ) : (
          <Select value={ownerUserId} onValueChange={setOwnerUserId}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="User" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {isTeamLead ? "All team members" : "All users"}
              </SelectItem>
              {ownerOptions.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {isAdmin ? (
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {(teamsQuery.data?.data ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Select value={typeCode} onValueChange={setTypeCode}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(typesQuery.data ?? []).map((t) => (
              <SelectItem key={t.id} value={t.code}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["upcoming", "due", "overdue", "completed", "cancelled"].map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {calendarQuery.isLoading ? (
        <CalendarSkeleton />
      ) : view === "month" ? (
        <MonthGrid
          cursor={cursor}
          timezone={timezone}
          byDay={byDay}
          onSelect={setSelected}
          onDayClick={(d) => {
            setCursor(d);
            setView("day");
          }}
          onDayCreate={can("activities:create") ? openCreateForDay : undefined}
        />
      ) : view === "agenda" ? (
        <AgendaList events={events} timezone={timezone} onSelect={setSelected} />
      ) : (
        <WeekDayStrip
          mode={view}
          cursor={cursor}
          timezone={timezone}
          byDay={byDay}
          onSelect={setSelected}
          onDayCreate={can("activities:create") ? openCreateForDay : undefined}
        />
      )}

      <ActivityQuickCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultDueAt={createDueAt}
        onCreated={() => void qc.invalidateQueries({ queryKey: ["calendar"] })}
      />

      <ActivityContextDialog
        activity={selected}
        timezone={timezone}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
}

function MonthGrid({
  cursor,
  timezone,
  byDay,
  onSelect,
  onDayClick,
  onDayCreate,
}: {
  cursor: Date;
  timezone: string;
  byDay: Map<string, Activity[]>;
  onSelect: (a: Activity) => void;
  onDayClick: (d: Date) => void;
  onDayCreate?: (d: Date) => void;
}) {
  const start = startOfWeek(startOfMonth(cursor));
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const month = cursor.getMonth();
  const todayKey = dayKeyInTimezone(new Date(), timezone);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_0_rgba(42,40,56,0.04)]">
      <div className="grid grid-cols-7 border-b border-border bg-surface-muted/60 text-label text-foreground-muted">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-2 text-center font-semibold tracking-wide">
            <span className="sm:hidden">{d.slice(0, 1)}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((d) => {
          const key = dayKeyInTimezone(d, timezone);
          const items = byDay.get(key) ?? [];
          const inMonth = d.getMonth() === month;
          const isToday = key === todayKey;
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <div
              key={key + d.toISOString()}
              className={cn(
                "group relative min-h-[96px] border-b border-r border-border p-1.5 transition-colors sm:min-h-[112px]",
                !inMonth && "bg-surface-muted/40",
                inMonth && isWeekend && "bg-surface-muted/20",
                isToday && "bg-brand-soft/40",
                "hover:bg-brand-soft/25",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <button
                  type="button"
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-[12px] font-medium transition-colors",
                    isToday
                      ? "bg-brand text-primary-foreground shadow-sm"
                      : "text-foreground hover:bg-surface-muted",
                    !inMonth && !isToday && "text-foreground-subtle",
                  )}
                  onClick={() => onDayClick(d)}
                >
                  {d.getDate()}
                </button>
                {onDayCreate && inMonth ? (
                  <button
                    type="button"
                    className="flex size-6 items-center justify-center rounded-md text-foreground-subtle opacity-0 transition-opacity hover:bg-surface-muted hover:text-foreground group-hover:opacity-100"
                    aria-label="Add activity"
                    onClick={() => onDayCreate(d)}
                  >
                    <Plus className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <ul className="space-y-0.5">
                {items.slice(0, 3).map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-medium transition-colors",
                        typeChip[a.typeColor ?? "slate"] ?? typeChip.slate,
                        a.displayStatus === "overdue" && "ring-1 ring-warning/40",
                      )}
                      onClick={() => onSelect(a)}
                    >
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          typeDot[a.typeColor ?? "slate"] ?? typeDot.slate,
                        )}
                      />
                      <span className="hidden truncate tabular-nums text-[9px] opacity-70 sm:inline">
                        {formatTimeInTimezone(eventInstant(a), timezone)}
                      </span>
                      <span className="truncate">{a.title}</span>
                    </button>
                  </li>
                ))}
                {items.length > 3 ? (
                  <li>
                    <button
                      type="button"
                      className="w-full px-1 text-left text-[10px] font-medium text-brand-dark hover:underline"
                      onClick={() => onDayClick(d)}
                    >
                      +{items.length - 3} more
                    </button>
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

function WeekDayStrip({
  mode,
  cursor,
  timezone,
  byDay,
  onSelect,
  onDayCreate,
}: {
  mode: "week" | "day";
  cursor: Date;
  timezone: string;
  byDay: Map<string, Activity[]>;
  onSelect: (a: Activity) => void;
  onDayCreate?: (d: Date) => void;
}) {
  const days =
    mode === "day"
      ? [cursor]
      : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i));
  const todayKey = dayKeyInTimezone(new Date(), timezone);

  return (
    <div className={cn("grid gap-2.5", mode === "week" ? "md:grid-cols-7" : "grid-cols-1")}>
      {days.map((d) => {
        const key = dayKeyInTimezone(d, timezone);
        const items = (byDay.get(key) ?? [])
          .slice()
          .sort((a, b) => +eventInstant(a) - +eventInstant(b));
        const isToday = key === todayKey;
        return (
          <section
            key={key}
            className={cn(
              "flex min-h-[180px] flex-col rounded-xl border border-border bg-surface p-2.5 shadow-[0_1px_0_rgba(42,40,56,0.04)] transition-shadow",
              isToday && "border-brand/30 ring-1 ring-brand/15",
            )}
          >
            <div className="mb-2 flex items-start justify-between gap-1">
              <div>
                <p
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wide",
                    isToday ? "text-brand-dark" : "text-foreground-muted",
                  )}
                >
                  {new Intl.DateTimeFormat(undefined, {
                    timeZone: timezone,
                    weekday: "short",
                  }).format(d)}
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {formatDateInTimezone(d, timezone)}
                </p>
              </div>
              {onDayCreate ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Add activity"
                  onClick={() => onDayCreate(d)}
                >
                  <Plus className="size-3.5" />
                </Button>
              ) : null}
            </div>
            <ul className="flex flex-1 flex-col gap-1.5">
              {items.length === 0 ? (
                <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border px-2 py-6 text-center text-[11px] text-foreground-subtle">
                  Free day
                </li>
              ) : (
                items.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-2 py-1.5 text-left transition-colors hover:border-brand/30 hover:bg-brand-soft/40"
                      onClick={() => onSelect(a)}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            typeDot[a.typeColor ?? "slate"] ?? typeDot.slate,
                          )}
                        />
                        <span className="truncate text-xs font-medium">{a.title}</span>
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-foreground-muted">
                        <Clock3 className="size-3 opacity-70" />
                        {formatTimeInTimezone(eventInstant(a), timezone)}
                        {a.displayStatus === "overdue" ? (
                          <span className="font-medium text-warning"> · Overdue</span>
                        ) : null}
                      </p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function AgendaList({
  events,
  timezone,
  onSelect,
}: {
  events: Activity[];
  timezone: string;
  onSelect: (a: Activity) => void;
}) {
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
          No activities in this range. Try another week or clear filters.
        </p>
      </div>
    );
  }

  const todayKey = dayKeyInTimezone(new Date(), timezone);

  return (
    <div className="space-y-3">
      {groups.map(([day, items]) => (
        <section
          key={day}
          className={cn(
            "overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_0_rgba(42,40,56,0.04)]",
            day === todayKey && "ring-1 ring-brand/20",
          )}
        >
          <div className="flex items-center justify-between border-b border-border bg-surface-muted/50 px-3 py-2">
            <h3 className="text-xs font-semibold text-foreground">
              {formatDateInTimezone(eventInstant(items[0]), timezone)}
              {day === todayKey ? (
                <span className="ml-2 rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-brand-dark">
                  Today
                </span>
              ) : null}
            </h3>
            <span className="text-[11px] text-foreground-subtle">
              {items.length} item{items.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="divide-y divide-border">
            {items.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-brand-soft/30"
                  onClick={() => onSelect(a)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          typeDot[a.typeColor ?? "slate"] ?? typeDot.slate,
                        )}
                      />
                      <p className="truncate text-sm font-medium">{a.title}</p>
                    </div>
                    <p className="mt-0.5 pl-4 text-xs text-foreground-muted">
                      {a.typeName ?? a.kind}
                      {a.customerName ? ` · ${a.customerName}` : ""}
                      {a.dealTitle ? ` · ${a.dealTitle}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs tabular-nums text-foreground-muted">
                      {formatTimeInTimezone(eventInstant(a), timezone)}
                    </p>
                    <StatusBadge tone={statusTone(a.displayStatus)} className="mt-1">
                      {a.displayStatus}
                    </StatusBadge>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ActivityContextDialog({
  activity,
  timezone,
  onOpenChange,
}: {
  activity: Activity | null;
  timezone: string;
  onOpenChange: (open: boolean) => void;
}) {
  const detailQuery = useQuery({
    queryKey: ["activity", activity?.id],
    queryFn: () => crmApi.getActivity(activity!.id),
    enabled: !!activity,
  });

  const a = detailQuery.data?.activity ?? activity;
  const ctx = detailQuery.data?.context;

  return (
    <Modal open={!!activity} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>{a?.title ?? "Activity"}</ModalTitle>
          <ModalDescription>
            {a ? formatInTimezone(eventInstant(a), timezone) : null}
          </ModalDescription>
        </ModalHeader>
        {a ? (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={statusTone(a.displayStatus)}>{a.displayStatus}</StatusBadge>
              <StatusBadge tone="neutral">{a.typeName ?? a.kind}</StatusBadge>
              <StatusBadge tone="brand">{a.priority}</StatusBadge>
            </div>
            <dl className="space-y-1.5 rounded-lg border border-border bg-surface-muted/40 p-3 text-xs">
              <div className="flex gap-2">
                <dt className="w-24 text-foreground-subtle">Owner</dt>
                <dd>{a.ownerName ?? "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 text-foreground-subtle">Customer</dt>
                <dd>{a.customerName ?? ctx?.customerName ?? "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 text-foreground-subtle">Deal</dt>
                <dd>{a.dealTitle ?? ctx?.dealTitle ?? "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 text-foreground-subtle">Lead</dt>
                <dd>{a.leadName ?? ctx?.leadName ?? "—"}</dd>
              </div>
            </dl>
            {a.notes ? <p className="text-xs text-foreground-muted">{a.notes}</p> : null}
          </div>
        ) : (
          <LoadingState compact />
        )}
        <ModalFooter className="flex-wrap">
          {ctx?.customerId || a?.customerId ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/customers/${ctx?.customerId ?? a?.customerId}`}>Customer</Link>
            </Button>
          ) : null}
          {ctx?.dealId || a?.dealId ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/deals/${ctx?.dealId ?? a?.dealId}`}>Deal</Link>
            </Button>
          ) : null}
          {ctx?.timelineHref ? (
            <Button asChild size="sm" variant="outline">
              <Link href={ctx.timelineHref}>Timeline</Link>
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
