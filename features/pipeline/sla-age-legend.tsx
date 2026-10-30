"use client";

import { cn } from "@/lib/utils";

const ITEMS = [
  { tone: "ok", label: "On track", hint: "Within stage time limit", swatch: "bg-success", ring: "ring-success/30" },
  { tone: "warn", label: "Near limit", hint: "About 80% of the stage SLA used", swatch: "bg-warning", ring: "ring-warning/30" },
  { tone: "over", label: "Overdue", hint: "Past the stage SLA — follow up", swatch: "bg-danger", ring: "ring-danger/30" },
] as const;

/** Compact key so SE/TL can read green / amber / red on pipeline cards. */
export function SlaAgeLegend({ className }: { className?: string }) {
  return (
    <div
      role="note"
      aria-label="Stage time limit colors"
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-line/80 bg-surface-muted/50 px-3 py-2 text-caption",
        className,
      )}
    >
      <span className="font-medium text-ink-secondary">Stage time</span>
      {ITEMS.map((item) => (
        <span key={item.tone} className="inline-flex items-center gap-1.5 text-ink-muted" title={item.hint}>
          <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full ring-2", item.swatch, item.ring)} />
          <span className="text-ink-secondary">{item.label}</span>
        </span>
      ))}
      <span className="text-ink-muted">Colors update as leads sit in a stage</span>
    </div>
  );
}
