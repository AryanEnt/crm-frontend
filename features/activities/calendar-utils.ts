"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmApi, type Activity } from "@/lib/api/crm";
import { DEFAULT_TIMEZONE, startOfDayInTimezone } from "@/lib/timezone";
import { invalidateLeadViews } from "./lead-moved";

export type CalendarData = Awaited<ReturnType<typeof crmApi.calendarActivities>>;

export const DEFAULT_DURATION_MIN = 30;
export const DAY_MINUTES = 24 * 60;

export { colorOf, statusTone, typeBlock, typeDot, typeDotClass, typeRing } from "./calendar-colors";

export function eventInstant(a: Activity): Date {
  return new Date(a.startAt || a.dueAt || a.createdAt);
}

export function eventEnd(a: Activity): Date {
  const start = eventInstant(a);
  if (a.startAt && a.endAt) {
    const end = new Date(a.endAt);
    if (end > start) return end;
  }
  return new Date(start.getTime() + DEFAULT_DURATION_MIN * 60_000);
}

export const isOpen = (a: Activity) => a.status !== "completed" && a.status !== "cancelled";

/** Minutes since midnight of `d` on the wall clock of `timeZone`. */
export function minutesInTimezone(d: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || DEFAULT_TIMEZONE,
      hourCycle: "h23",
      hour: "numeric",
      minute: "numeric",
    }).formatToParts(d);
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return get("hour") * 60 + get("minute");
  } catch {
    return d.getHours() * 60 + d.getMinutes();
  }
}

/** The instant of `minutes` past midnight on a grid cell's calendar date, in `timeZone`. */
export function instantAt(day: Date, minutes: number, timeZone: string): Date {
  return new Date(startOfDayInTimezone(day, timeZone).getTime() + minutes * 60_000);
}

export function formatClock(minutes: number): string {
  const d = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d);
}

/** Moves the activity so it starts at `start`, keeping its duration and due offset. */
export function rescheduleFields(a: Activity, start: Date): Partial<Activity> {
  const delta = start.getTime() - eventInstant(a).getTime();
  const shift = (v: string) => new Date(new Date(v).getTime() + delta).toISOString();
  const fields: Partial<Activity> = {};
  if (a.startAt) fields.startAt = shift(a.startAt);
  if (a.endAt) fields.endAt = shift(a.endAt);
  if (a.dueAt) fields.dueAt = shift(a.dueAt);
  else if (!a.startAt) fields.dueAt = start.toISOString();
  return fields;
}

export type PlacedEvent = { activity: Activity; start: number; end: number; col: number; cols: number };

/** Side-by-side columns for overlapping events within one day; `minSpan` keeps tiny blocks from colliding. */
export function layoutDay(items: Activity[], dayStart: Date, minSpan: number): PlacedEvent[] {
  const dayStartMs = dayStart.getTime();
  const spans = items
    .map((activity) => {
      const start = Math.max(0, Math.round((eventInstant(activity).getTime() - dayStartMs) / 60_000));
      const rawEnd = Math.round((eventEnd(activity).getTime() - dayStartMs) / 60_000);
      const end = Math.min(DAY_MINUTES, Math.max(rawEnd, start + minSpan));
      return { activity, start, end, col: 0, cols: 1 };
    })
    .sort((x, y) => x.start - y.start || y.end - x.end);

  const placed: PlacedEvent[] = [];
  let cluster: PlacedEvent[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const p of cluster) p.cols = columnEnds.length;
    placed.push(...cluster);
    cluster = [];
    columnEnds = [];
  };
  for (const span of spans) {
    if (span.start >= clusterEnd) flush();
    let col = columnEnds.findIndex((end) => end <= span.start);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(span.end);
    } else {
      columnEnds[col] = span.end;
    }
    span.col = col;
    cluster.push(span);
    clusterEnd = Math.max(clusterEnd, span.end);
  }
  flush();
  return placed;
}

type UpdateVars = { activity: Activity; fields: Partial<Activity> };

/** PATCHes an activity with an optimistic calendar update; rolls back and toasts on failure. */
export function useUpdateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ activity, fields }: UpdateVars) => {
      const body = { ...fields };
      delete body.displayStatus;
      return crmApi.updateActivity(activity.id, body);
    },
    onMutate: async ({ activity, fields }: UpdateVars) => {
      await qc.cancelQueries({ queryKey: ["calendar"] });
      const snapshot = qc.getQueriesData<CalendarData>({ queryKey: ["calendar"] });
      const patched = { ...activity, ...fields };
      if (fields.status === undefined && isOpen(patched)) {
        patched.displayStatus = eventInstant(patched).getTime() < Date.now() ? "overdue" : "upcoming";
      }
      qc.setQueriesData<CalendarData>({ queryKey: ["calendar"] }, (old) =>
        old ? { ...old, data: old.data.map((a) => (a.id === activity.id ? patched : a)) } : old,
      );
      return { snapshot };
    },
    onSuccess: (result) => {
      if (result.leadMovedTo) invalidateLeadViews(qc, result.leadId);
    },
    onError: (err, _vars, ctx) => {
      for (const [key, data] of ctx?.snapshot ?? []) qc.setQueryData(key, data);
      toast.error(err instanceof Error ? err.message : "Could not update activity");
    },
    onSettled: (_data, _err, { activity }) => {
      void qc.invalidateQueries({ queryKey: ["calendar"] });
      void qc.invalidateQueries({ queryKey: ["activity", activity.id] });
      void qc.invalidateQueries({ queryKey: ["activities"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
