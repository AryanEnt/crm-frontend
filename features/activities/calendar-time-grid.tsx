"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import type { Activity } from "@/lib/api/crm";
import { calendarDayKey, dayKeyInTimezone, startOfDayInTimezone } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import {
  DAY_MINUTES,
  DEFAULT_DURATION_MIN,
  colorOf,
  eventEnd,
  eventInstant,
  formatClock,
  instantAt,
  isOpen,
  layoutDay,
  minutesInTimezone,
  typeBlock,
  typeDot,
} from "./calendar-utils";

const HOUR_PX = 52;
const PX_PER_MIN = HOUR_PX / 60;
const CREATE_SNAP = 30;
const DRAG_SNAP = 15;
const MIN_BLOCK_MIN = 24;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

type Slot = { key: string; minutes: number; duration: number };
type Drag = { activity: Activity; grabMinutes: number; duration: number };

const snap = (minutes: number, step: number) =>
  Math.min(DAY_MINUTES - step, Math.max(0, Math.floor(minutes / step) * step));

function useNow(intervalMs: number) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function TimeGrid({
  days,
  timezone,
  byDay,
  onSelect,
  onCreateAt,
  onMove,
  onDayOpen,
}: {
  days: Date[];
  timezone: string;
  byDay: Map<string, Activity[]>;
  onSelect: (a: Activity) => void;
  onCreateAt?: (day: Date, minutes: number) => void;
  onMove?: (a: Activity, start: Date) => void;
  onDayOpen?: (day: Date) => void;
}) {
  const now = useNow(60_000);
  const todayKey = dayKeyInTimezone(new Date(now), timezone);
  const nowMinutes = minutesInTimezone(new Date(now), timezone);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<Drag | null>(null);
  const [hover, setHover] = React.useState<Slot | null>(null);
  const [drop, setDrop] = React.useState<Slot | null>(null);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);

  const columns = React.useMemo(
    () =>
      days.map((day) => {
        const key = calendarDayKey(day);
        const dayStart = startOfDayInTimezone(day, timezone);
        return { day, key, placed: layoutDay(byDay.get(key) ?? [], dayStart, MIN_BLOCK_MIN) };
      }),
    [days, byDay, timezone],
  );

  const rangeKey = columns.map((c) => c.key).join(",");
  const hasToday = columns.some((c) => c.key === todayKey);
  const earliest = Math.min(...columns.flatMap((c) => c.placed.map((p) => p.start)), DAY_MINUTES);

  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const focusMinutes = hasToday ? nowMinutes : earliest < DAY_MINUTES ? earliest : 8 * 60;
    el.scrollTop = Math.max(0, (focusMinutes - 60) * PX_PER_MIN);
    // Only when the visible range changes, not on every tick or data refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  const minutesFromPointer = (event: React.PointerEvent | React.DragEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return (event.clientY - rect.top) / PX_PER_MIN;
  };

  const week = days.length > 1;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_0_rgba(42,40,56,0.04)]">
      <div ref={scrollRef} className="max-h-[min(72vh,760px)] overflow-auto overscroll-contain">
        <div className={cn("relative", week && "min-w-[760px]")}>
          <div
            className="sticky top-0 z-20 grid border-b border-border bg-surface/95 backdrop-blur-sm"
            style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}
          >
            <div className="flex items-end justify-end px-2 pb-1.5 text-[10px] text-foreground-subtle">
              {new Intl.DateTimeFormat(undefined, { timeZoneName: "short", timeZone: timezone })
                .formatToParts(new Date(now))
                .find((p) => p.type === "timeZoneName")?.value ?? ""}
            </div>
            {columns.map(({ day, key, placed }) => {
              const isToday = key === todayKey;
              const header = (
                <>
                  <span
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wide",
                      isToday ? "text-brand-dark" : "text-foreground-muted",
                    )}
                  >
                    {new Intl.DateTimeFormat(undefined, { weekday: week ? "short" : "long" }).format(day)}
                  </span>
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-[15px] font-semibold tabular-nums",
                      isToday ? "bg-brand text-primary-foreground shadow-sm" : "text-foreground",
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <span className="text-[10px] text-foreground-subtle">
                    {placed.length ? `${placed.length} item${placed.length === 1 ? "" : "s"}` : "\u00a0"}
                  </span>
                </>
              );
              return week && onDayOpen ? (
                <button
                  key={key}
                  type="button"
                  title="Open day"
                  onClick={() => onDayOpen(day)}
                  className="flex flex-col items-center gap-0.5 border-l border-border py-1.5 transition-colors hover:bg-surface-muted/60"
                >
                  {header}
                </button>
              ) : (
                <div key={key} className="flex flex-col items-center gap-0.5 border-l border-border py-1.5">
                  {header}
                </div>
              );
            })}
          </div>

          <div
            className="relative grid"
            style={{
              gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))`,
              height: 24 * HOUR_PX,
            }}
          >
            <div className="relative">
              {HOURS.map((h) =>
                h === 0 ? null : (
                  <span
                    key={h}
                    className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-foreground-subtle"
                    style={{ top: h * HOUR_PX }}
                  >
                    {formatClock(h * 60).replace(":00", "")}
                  </span>
                ),
              )}
            </div>

            {columns.map(({ day, key, placed }) => {
              const isToday = key === todayKey;
              const hoverHere = hover?.key === key ? hover : null;
              const dropHere = drop?.key === key ? drop : null;
              return (
                <div
                  key={key}
                  className={cn(
                    "relative border-l border-border",
                    isToday && "bg-brand-soft/20",
                    onCreateAt && "cursor-pointer",
                  )}
                  onPointerMove={(event) => {
                    if (!onCreateAt || (event.target as HTMLElement).closest("[data-event]")) {
                      if (hoverHere) setHover(null);
                      return;
                    }
                    const minutes = snap(minutesFromPointer(event), CREATE_SNAP);
                    if (hoverHere?.minutes !== minutes) setHover({ key, minutes, duration: CREATE_SNAP });
                  }}
                  onPointerLeave={() => setHover(null)}
                  onClick={(event) => {
                    if (!onCreateAt || (event.target as HTMLElement).closest("[data-event]")) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    onCreateAt(day, snap((event.clientY - rect.top) / PX_PER_MIN, CREATE_SNAP));
                  }}
                  onDragOver={(event) => {
                    const drag = dragRef.current;
                    if (!drag || !onMove) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    const minutes = snap(minutesFromPointer(event) - drag.grabMinutes, DRAG_SNAP);
                    if (dropHere?.minutes !== minutes) setDrop({ key, minutes, duration: drag.duration });
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrop(null);
                  }}
                  onDrop={(event) => {
                    const drag = dragRef.current;
                    if (!drag || !onMove) return;
                    event.preventDefault();
                    const minutes = snap(minutesFromPointer(event) - drag.grabMinutes, DRAG_SNAP);
                    dragRef.current = null;
                    setDrop(null);
                    const target = instantAt(day, minutes, timezone);
                    if (target.getTime() !== eventInstant(drag.activity).getTime()) onMove(drag.activity, target);
                  }}
                >
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute inset-x-0 border-t",
                        h === 0 ? "border-transparent" : "border-border/70",
                      )}
                      style={{ top: h * HOUR_PX }}
                    >
                      <div className="border-t border-dashed border-border/35" style={{ marginTop: HOUR_PX / 2 - 1 }} />
                    </div>
                  ))}

                  {hoverHere && !drop ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-1 z-[1] flex items-center gap-1 rounded-md border border-dashed border-brand/40 bg-brand-soft/50 px-1.5 text-[10px] font-medium text-brand-dark"
                      style={{ top: hoverHere.minutes * PX_PER_MIN, height: hoverHere.duration * PX_PER_MIN }}
                    >
                      <Plus className="size-3" />
                      {formatClock(hoverHere.minutes)}
                    </div>
                  ) : null}

                  {dropHere ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-1 z-[3] rounded-md border-2 border-dashed border-brand bg-brand-soft/60 px-1.5 py-0.5 text-[10px] font-semibold text-brand-dark"
                      style={{
                        top: dropHere.minutes * PX_PER_MIN,
                        height: Math.max(MIN_BLOCK_MIN, dropHere.duration) * PX_PER_MIN,
                      }}
                    >
                      {formatClock(dropHere.minutes)}
                    </div>
                  ) : null}

                  {placed.map(({ activity: a, start, end, col, cols }) => {
                    const height = (end - start) * PX_PER_MIN;
                    const open = isOpen(a);
                    const draggable = Boolean(onMove) && open;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        data-event
                        draggable={draggable}
                        onDragStart={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          const duration = Math.round((eventEnd(a).getTime() - eventInstant(a).getTime()) / 60_000);
                          dragRef.current = {
                            activity: a,
                            grabMinutes: (event.clientY - rect.top) / PX_PER_MIN,
                            duration: duration || DEFAULT_DURATION_MIN,
                          };
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", a.id);
                          setHover(null);
                          setDraggingId(a.id);
                        }}
                        onDragEnd={() => {
                          dragRef.current = null;
                          setDrop(null);
                          setDraggingId(null);
                        }}
                        onClick={() => onSelect(a)}
                        title={`${a.title} · ${formatClock(minutesInTimezone(eventInstant(a), timezone))}`}
                        className={cn(
                          "absolute z-[2] overflow-hidden rounded-md border border-l-[3px] border-border/40 px-1.5 py-0.5 text-left shadow-[0_1px_2px_rgba(42,40,56,0.08)] transition-[box-shadow,opacity] hover:z-[4] hover:shadow-md focus-visible:z-[4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                          colorOf(typeBlock, a.typeColor),
                          a.displayStatus === "overdue" && "ring-1 ring-warning/60",
                          !open && "opacity-60",
                          draggable && "cursor-grab active:cursor-grabbing",
                          draggingId === a.id && "opacity-40",
                        )}
                        style={{
                          top: start * PX_PER_MIN,
                          height: Math.max(height - 2, 18),
                          left: `calc(${(col / cols) * 100}% + 2px)`,
                          width: `calc(${100 / cols}% - 4px)`,
                        }}
                      >
                        <span className={cn("block truncate text-[11px] font-semibold leading-tight text-foreground", !open && "line-through")}>
                          {a.title}
                        </span>
                        {height >= 34 ? (
                          <span className="block truncate text-[10px] tabular-nums leading-tight text-foreground-muted">
                            {formatClock(minutesInTimezone(eventInstant(a), timezone))} –{" "}
                            {formatClock(minutesInTimezone(eventEnd(a), timezone))}
                          </span>
                        ) : null}
                        {height >= 50 && (a.leadName || a.customerName || a.dealTitle) ? (
                          <span className="mt-0.5 flex items-center gap-1 truncate text-[10px] leading-tight text-foreground-muted">
                            <span className={cn("size-1.5 shrink-0 rounded-full", colorOf(typeDot, a.typeColor))} />
                            <span className="truncate">{a.leadName || a.customerName || a.dealTitle}</span>
                          </span>
                        ) : null}
                      </button>
                    );
                  })}

                  {isToday ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 z-[5] flex items-center"
                      style={{ top: nowMinutes * PX_PER_MIN }}
                    >
                      <span className="-ml-1 size-2 rounded-full bg-destructive" />
                      <span className="h-0.5 flex-1 bg-destructive/80" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
