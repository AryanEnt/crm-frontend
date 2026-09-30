import Link from "next/link";
import { type LucideIcon, ArrowRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type MetricCardProps = {
  label: string;
  value: string;
  hint?: string;
  delta?: number;
  icon?: LucideIcon;
  /** Makes the whole card a link to the page behind the metric. */
  href?: string;
  className?: string;
};

export function MetricCard({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  href,
  className,
}: MetricCardProps) {
  const DeltaIcon =
    delta === undefined || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const deltaTone =
    delta === undefined || delta === 0
      ? "text-foreground-muted"
      : delta > 0
        ? "text-success"
        : "text-danger";

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-label text-foreground-muted">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-[var(--radius-md)] bg-surface-muted text-foreground-muted",
              href && "transition-colors duration-150 group-hover:bg-brand-soft group-hover:text-brand",
            )}
          >
            <Icon className="size-3.5" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-kpi">{value}</p>
      <div className="mt-1.5 flex items-center gap-2 text-meta">
        {delta !== undefined ? (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", deltaTone)}>
            <DeltaIcon className="size-3" />
            {delta > 0 ? "+" : ""}
            {delta}%
          </span>
        ) : null}
        {hint ? <span className="text-foreground-subtle">{hint}</span> : null}
        {href ? (
          <ArrowRight
            aria-hidden
            className="ml-auto size-3.5 -translate-x-1 text-brand opacity-0 transition-[opacity,translate] duration-150 ease-standard group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:translate-x-0"
          />
        ) : null}
      </div>
    </>
  );

  const base = "rounded-lg border border-border bg-surface p-3.5";

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          base,
          "group block transition-[border-color,box-shadow] duration-150 ease-standard hover:border-brand-border hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
      >
        {body}
      </Link>
    );
  }

  return <div className={cn(base, className)}>{body}</div>;
}
