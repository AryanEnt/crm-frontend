"use client";

import type { ReactNode } from "react";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLeadMoney } from "@/features/leads/lead-format";
import { cn } from "@/lib/utils";
import type { PipelineStatus, PipelineTotals } from "./pipeline-totals";

const percent = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

function Tile({
  label,
  children,
  footer,
  onClick,
  pressed,
}: {
  label: string;
  children: ReactNode;
  footer?: ReactNode;
  onClick?: () => void;
  pressed?: boolean;
}) {
  const body = (
    <>
      <span className="text-caption font-medium text-ink-muted">{label}</span>
      <span className="mt-1.5 block text-[1.375rem] font-semibold leading-7 tracking-[-0.01em] tabular-nums text-ink">
        {children}
      </span>
      {footer ? <span className="mt-1 block text-caption text-ink-muted">{footer}</span> : null}
    </>
  );
  const base = "rounded-card border border-line/70 bg-surface px-4 py-3.5 text-left shadow-card";
  if (!onClick) return <div className={base}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        base,
        "transition-[box-shadow,border-color] duration-150 hover:border-line-strong hover:shadow-lift motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        pressed && "border-brand/40",
      )}
    >
      {body}
    </button>
  );
}

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
  const closed = totals.wonCount + totals.lostCount;
  return (
    <section aria-label="Pipeline summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        label="Open leads"
        onClick={() => onStatus("open")}
        pressed={status === "open"}
        footer={`${totals.totalCount} in total`}
      >
        {totals.openCount}
      </Tile>
      <Tile label="Open pipeline value" footer="Sum of open lead values">
        {formatLeadMoney(totals.openValue, currency)}
      </Tile>
      <Tile label="Weighted value" footer="Value × stage probability">
        {formatLeadMoney(totals.weightedValue, currency)}
      </Tile>
      <div className="flex items-center gap-3 rounded-card border border-line/70 bg-surface px-4 py-3.5 shadow-card">
        <div className="min-w-0 flex-1">
          <span className="text-caption font-medium text-ink-muted">Win rate</span>
          <span className="mt-1.5 block text-[1.375rem] font-semibold leading-7 tracking-[-0.01em] tabular-nums text-ink">
            {percent(totals.winRate)}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-1 text-caption text-ink-muted">
            <OutcomeLink
              active={status === "won" || status === "complete"}
              onClick={() => onStatus(nurturing ? "complete" : "won")}
            >
              {totals.wonCount} {nurturing ? "complete" : "won"}
            </OutcomeLink>
            <span aria-hidden>·</span>
            <OutcomeLink active={status === "lost"} onClick={() => onStatus("lost")}>
              {totals.lostCount} lost
            </OutcomeLink>
          </span>
        </div>
        <ProgressRing
          value={totals.winRate}
          size={44}
          strokeWidth={3}
          label={
            closed > 0
              ? nurturing
                ? `Complete rate ${percent(totals.winRate)}: ${totals.wonCount} complete of ${closed} closed`
                : `Win rate ${percent(totals.winRate)}: ${totals.wonCount} won of ${closed} closed`
              : "Win rate: no closed leads yet"
          }
        />
      </div>
    </section>
  );
}

function OutcomeLink({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-sm tabular-nums underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "font-medium text-brand-ink",
      )}
    >
      {children}
    </button>
  );
}

export function PipelineStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-card border border-line/70 bg-surface px-4 py-3.5 shadow-card">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2.5 h-6 w-20" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}
