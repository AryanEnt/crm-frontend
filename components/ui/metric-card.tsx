import { type LucideIcon, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type MetricCardProps = {
  label: string;
  value: string;
  hint?: string;
  delta?: number;
  icon?: LucideIcon;
  className?: string;
};

export function MetricCard({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  className,
}: MetricCardProps) {
  const DeltaIcon =
    delta === undefined || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const deltaTone =
    delta === undefined || delta === 0
      ? "text-foreground-muted"
      : delta > 0
        ? "text-success"
        : "text-destructive";

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-3.5 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-foreground-muted">{label}</p>
        {Icon ? (
          <span className="flex size-7 items-center justify-center rounded-md bg-brand-soft text-brand-dark">
            <Icon className="size-3.5" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{value}</p>
      <div className="mt-1.5 flex items-center gap-2 text-[11px]">
        {delta !== undefined ? (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", deltaTone)}>
            <DeltaIcon className="size-3" />
            {delta > 0 ? "+" : ""}
            {delta}%
          </span>
        ) : null}
        {hint ? <span className="text-foreground-subtle">{hint}</span> : null}
      </div>
    </div>
  );
}
