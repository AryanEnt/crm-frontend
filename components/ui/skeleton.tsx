import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn("animate-pulse rounded-sm bg-surface-muted", className)}
      style={style}
      aria-hidden
    />
  );
}

/** Content-shaped table loading — prefer over a centered spinner for list modules. */
export function TableSkeleton({
  rows = 8,
  cols = 5,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-md border border-border bg-surface", className)}
      role="status"
      aria-label="Loading"
      aria-busy="true"
    >
      <div className="flex gap-3 border-b border-border bg-surface-muted/50 px-3 py-2">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-3 flex-1" />
        ))}
      </div>
      <ul className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <li key={r} className="flex items-center gap-3 px-3 density-row">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={`${r}-${c}`}
                className={cn("h-3 flex-1", c === 0 && "max-w-[28%]")}
              />
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Board column skeletons for deals pipeline. */
export function BoardSkeleton({ columns = 4, className }: { columns?: number; className?: string }) {
  return (
    <div
      className={cn("flex gap-3 overflow-x-auto pb-2", className)}
      role="status"
      aria-label="Loading board"
      aria-busy="true"
    >
      {Array.from({ length: columns }).map((_, i) => (
        <div
          key={i}
          className="w-64 shrink-0 rounded-md border border-border bg-surface p-2"
        >
          <Skeleton className="mb-3 h-4 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Profile / 360 overview skeleton. */
export function DetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)} role="status" aria-label="Loading" aria-busy="true">
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

/** KPI strip for dashboards / analytics (§5.4). */
export function KpiStripSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}
      role="status"
      aria-label="Loading metrics"
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-3.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-24" />
          <Skeleton className="mt-2 h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Chart panel placeholder. */
export function ChartSkeleton({ className, height = 240 }: { className?: string; height?: number }) {
  return (
    <div
      className={cn("space-y-3", className)}
      role="status"
      aria-label="Loading chart"
      aria-busy="true"
      style={{ minHeight: height }}
    >
      <Skeleton className="h-3 w-32" />
      <Skeleton className="w-full" style={{ height: height - 24 }} />
    </div>
  );
}

/** Month grid for calendar module. */
export function CalendarSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("overflow-hidden rounded-lg border border-border bg-surface", className)}
      role="status"
      aria-label="Loading calendar"
      aria-busy="true"
    >
      <div className="grid grid-cols-7 border-b border-border bg-surface-muted/50">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="px-2 py-2">
            <Skeleton className="mx-auto h-3 w-8" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="min-h-[72px] border-b border-r border-border p-1.5">
            <Skeleton className="mb-2 h-3 w-5" />
            {i % 4 === 0 ? <Skeleton className="h-4 w-full" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
