"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { formatStageDuration } from "@/features/leads/lead-format";
import { crmApi, type LeadStagePeriod } from "@/lib/api/crm";
import { formatInTimezone } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

function when(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—";
  return formatInTimezone(iso, timeZone, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function liveSeconds(period: LeadStagePeriod, nowMs: number): number {
  if (!period.isCurrent) return period.durationSeconds;
  return Math.max(0, Math.floor((nowMs - new Date(period.enteredAt).getTime()) / 1000));
}

function PeriodCard({
  period,
  timeZone,
  durationSeconds,
}: {
  period: LeadStagePeriod;
  timeZone: string;
  durationSeconds: number;
}) {
  const changedBy = period.isCurrent
    ? period.enteredByName
    : period.exitedByName ?? period.enteredByName;

  return (
    <li className="relative pl-6">
      <span
        className={cn(
          "absolute left-0 top-1.5 size-2.5 rounded-full ring-4 ring-surface",
          period.isCurrent ? "bg-brand" : "bg-ink-muted",
        )}
        aria-hidden
      />
      <div
        className={cn(
          "rounded-xl border px-3.5 py-3",
          period.isCurrent ? "border-brand/30 bg-brand/5" : "border-border bg-surface",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold text-ink">{period.stageName}</h4>
          {period.isCurrent ? (
            <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
              Current stage
            </span>
          ) : null}
        </div>
        <dl className="mt-2 space-y-1 text-xs text-ink-secondary">
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-ink-muted">Entered</dt>
            <dd>{when(period.enteredAt, timeZone)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-ink-muted">Exited</dt>
            <dd>{period.isCurrent ? "Not yet exited" : when(period.exitedAt, timeZone)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-ink-muted">Time spent</dt>
            <dd>
              {formatStageDuration(durationSeconds)}
              {period.isCurrent ? " (live)" : ""}
            </dd>
          </div>
          {!period.isCurrent && period.movedToStageName ? (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-ink-muted">Moved to</dt>
              <dd className="font-medium text-ink">{period.movedToStageName}</dd>
            </div>
          ) : null}
          {changedBy ? (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-ink-muted">Changed by</dt>
              <dd>{changedBy}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </li>
  );
}

/** Vertical timeline of every stage visit for a lead (oldest first, current last). */
export function LeadHistory({ leadId }: { leadId: string }) {
  const { user } = useAuth();
  const timeZone = user?.timezone ?? "";
  const q = useQuery({
    queryKey: ["lead", leadId, "stage-history"],
    queryFn: () => crmApi.getLeadStageHistory(leadId),
    refetchInterval: 60_000,
  });
  const periods = q.data?.periods ?? [];
  const hasCurrent = periods.some((p) => p.isCurrent);
  const baseNowMs = q.data?.serverNow ? new Date(q.data.serverNow).getTime() : q.dataUpdatedAt;
  const dataKey = q.dataUpdatedAt;
  const [tickKey, setTickKey] = React.useState(dataKey);
  const [extraMs, setExtraMs] = React.useState(0);
  if (dataKey !== tickKey) {
    setTickKey(dataKey);
    setExtraMs(0);
  }
  React.useEffect(() => {
    if (!hasCurrent) return;
    const id = window.setInterval(() => setExtraMs((n) => n + 60_000), 60_000);
    return () => window.clearInterval(id);
  }, [hasCurrent, dataKey]);

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />;

  if (periods.length === 0) {
    return (
      <EmptyState
        title="No stage history yet"
        description="History appears when this lead is created or moved between stages."
      />
    );
  }

  const nowMs = (baseNowMs || 0) + extraMs;

  return (
    <ol className="relative space-y-3 before:absolute before:bottom-3 before:left-[4px] before:top-3 before:w-px before:bg-line">
      {periods.map((period) => (
        <PeriodCard
          key={period.id}
          period={period}
          timeZone={timeZone}
          durationSeconds={liveSeconds(period, nowMs)}
        />
      ))}
    </ol>
  );
}
