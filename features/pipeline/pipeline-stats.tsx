"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLeadMoney } from "@/features/leads/lead-format";
import { cn } from "@/lib/utils";
import type { PipelineStatus, PipelineTotals } from "./pipeline-totals";

const percent = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

export function PipelineStats({
  totals,
  currency,
  status,
  nurturing = false,
  onStatus,
}: {
  totals: PipelineTotals;
  currency: string;
  status: PipelineStatus;
  nurturing?: boolean;
  onStatus: (status: PipelineStatus) => void;
}) {
  const wonLabel = nurturing ? "outcome" : "purchased";
  const needYou =
    status === "open" || status === "all"
      ? null
      : status === "lost"
        ? "lost"
        : wonLabel;

  return (
    <section
      aria-label="Pipeline summary"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line/70 bg-surface px-3.5 py-2.5 text-caption shadow-xs"
    >
      <p className="font-medium text-ink-secondary">
        {totals.openCount} open
        {totals.openValue > 0 ? (
          <span className="font-normal text-ink-muted"> · {formatLeadMoney(totals.openValue, currency)}</span>
        ) : null}
      </p>
      <span className="text-ink-subtle" aria-hidden>
        ·
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusChip active={status === "open"} onClick={() => onStatus("open")}>
          Open
        </StatusChip>
        <StatusChip
          active={status === "won" || status === "complete"}
          onClick={() => onStatus(nurturing ? "complete" : "won")}
        >
          {totals.wonCount} {wonLabel}
        </StatusChip>
        <StatusChip active={status === "lost"} onClick={() => onStatus("lost")}>
          {totals.lostCount} lost
        </StatusChip>
        {status !== "all" ? (
          <StatusChip active={false} onClick={() => onStatus("all")}>
            All
          </StatusChip>
        ) : null}
      </div>
      {totals.winRate != null ? (
        <p className="ml-auto tabular-nums text-ink-muted">
          {percent(totals.winRate)} {nurturing ? "outcome rate" : "win rate"}
          {needYou ? ` · showing ${needYou}` : null}
        </p>
      ) : (
        <p className="ml-auto text-ink-muted">These are your open deals. Red needs you now.</p>
      )}
    </section>
  );
}

function StatusChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-7 rounded-full px-2.5 font-medium tabular-nums transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-brand-soft text-brand-ink" : "text-ink-muted hover:bg-surface-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function PipelineStatsSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line/70 bg-surface px-3.5 py-2.5" aria-hidden>
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-7 w-16 rounded-full" />
      <Skeleton className="h-7 w-24 rounded-full" />
    </div>
  );
}
