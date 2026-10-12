"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlarmClock,
  CalendarClock,
  CalendarX,
  Hourglass,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StageRibbon, StageRibbonLegend, type RibbonSegment } from "@/components/ui/stage-ribbon";
import { stageSlotFromPipeline } from "@/components/ui/stage-rail";
import { formatLeadMoney, formatNextAction } from "@/features/leads/lead-format";
import type { LeadDayBucket, LeadDayItem, LeadMyDay, LeadOverview } from "@/lib/api/crm";
import { cn } from "@/lib/utils";

const BUCKETS: Array<{
  key: LeadDayBucket;
  title: string;
  hint: string;
  empty: string;
  icon: LucideIcon;
  tone: string;
  activity?: string;
}> = [
  {
    key: "overdue",
    title: "Overdue",
    hint: "Next action is past due",
    empty: "Nothing overdue.",
    icon: AlarmClock,
    tone: "bg-danger-soft text-danger",
    activity: "overdue",
  },
  {
    key: "today",
    title: "Today",
    hint: "Due today",
    empty: "Nothing else due today.",
    icon: CalendarClock,
    tone: "bg-brand-soft text-brand",
    activity: "today",
  },
  {
    key: "noNextAction",
    title: "No next action",
    hint: "Open leads with nothing scheduled",
    empty: "Every open lead has a next step.",
    icon: CalendarX,
    tone: "bg-warning-soft text-warning",
    activity: "none",
  },
  {
    key: "stale",
    title: "Going stale",
    hint: "No activity in 7+ days",
    empty: "No stale leads.",
    icon: Hourglass,
    tone: "bg-surface-muted text-ink-secondary",
  },
  {
    key: "recentlyWon",
    title: "Recently won",
    hint: "Last 14 days",
    empty: "No wins in the last two weeks yet.",
    icon: Trophy,
    tone: "bg-success-soft text-success",
  },
  {
    key: "recentlyCreated",
    title: "New leads",
    hint: "Created in the last 7 days",
    empty: "No new leads this week.",
    icon: Sparkles,
    tone: "bg-info-soft text-info",
  },
];

function itemMeta(bucket: LeadDayBucket, item: LeadDayItem): string {
  switch (bucket) {
    case "overdue":
    case "today":
      return [formatNextAction(item.nextActivityAt), item.nextActivityTitle].filter(Boolean).join(" · ");
    case "stale":
      return item.lastActivityAt
        ? `Last touch ${new Date(item.lastActivityAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
        : "Never contacted";
    case "recentlyWon":
      return item.wonAt
        ? `Won ${new Date(item.wonAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
        : "Won";
    case "recentlyCreated":
      return `Added ${new Date(item.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
    default:
      return item.stageName ?? "";
  }
}

export function LeadMyDaySection({
  data,
  loading,
  showOwner,
}: {
  data?: LeadMyDay;
  loading: boolean;
  showOwner?: boolean;
}) {
  return (
    <section aria-label="My day" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {BUCKETS.map((b) => {
        const items = data?.[b.key] ?? [];
        const count = data?.counts[b.key] ?? 0;
        const Icon = b.icon;
        const viewAll = b.activity ? `/leads?activity=${b.activity}` : "/leads";
        return (
          <div key={b.key} className="flex flex-col rounded-card border border-line bg-surface p-4 shadow-xs">
            <div className="flex items-start gap-2.5">
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", b.tone)}>
                <Icon className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-2 text-section">
                  {b.title}
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-muted px-1.5 text-caption font-medium tabular-nums text-ink-secondary">
                    {loading ? "…" : count}
                  </span>
                </h3>
                <p className="text-meta">{b.hint}</p>
              </div>
            </div>
            <div className="mt-3 flex-1">
              {loading ? (
                <div className="space-y-2" aria-busy="true">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : items.length === 0 ? (
                <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-meta">{b.empty}</p>
              ) : (
                <ul className="-mx-2 space-y-0.5">
                  {items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/leads?leadId=${encodeURIComponent(item.id)}`}
                        className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body font-medium text-ink">{item.fullName}</span>
                          <span className="block truncate text-meta">
                            {itemMeta(b.key, item)}
                            {showOwner && item.ownerName ? ` · ${item.ownerName}` : ""}
                          </span>
                        </span>
                        {item.potentialValue != null ? (
                          <span className="shrink-0 text-numeral-sm">
                            {formatLeadMoney(item.potentialValue, item.currency)}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {!loading && count > items.length ? (
              <Link href={viewAll} className="mt-2 text-caption font-medium text-brand hover:text-brand-hover">
                {count - items.length} more
              </Link>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

/** Open stages of the default lead pipeline as one ribbon, by value (or by count when no values). */
export function LeadPipelineStrip({ overview, loading }: { overview?: LeadOverview; loading: boolean }) {
  const open = (overview?.stages ?? []).filter((s) => !s.isWon && !s.isLost);
  const useValue = open.some((s) => s.value > 0);
  const segments: RibbonSegment[] = open.map((s, i) => ({
    id: s.id,
    label: s.name,
    value: useValue ? s.value : s.count,
    slot: stageSlotFromPipeline({ position: i, openStageCount: open.length }),
  }));
  const format = (v: number) => (useValue ? formatLeadMoney(v, overview?.currency) : `${v} ${v === 1 ? "lead" : "leads"}`);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading pipeline">
        <Skeleton className="h-3 w-full rounded-[2px]" />
        <div className="flex gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20" />
          ))}
        </div>
      </div>
    );
  }
  if (segments.length === 0 || segments.every((s) => s.value === 0)) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-body text-ink-muted">
        No open leads in the pipeline yet.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <StageRibbon size="lg" segments={segments} label="Open leads by stage" formatValue={format} />
      <StageRibbonLegend segments={segments} formatValue={format} />
    </div>
  );
}
