import { cn } from "@/lib/utils";

/** Thin circular progress. `value` is 0–1; null draws only the track. */
export function ProgressRing({
  value,
  size = 36,
  strokeWidth = 3,
  label,
  className,
}: {
  value: number | null;
  size?: number;
  strokeWidth?: number;
  label: string;
  className?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.min(1, Math.max(0, value));
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      className={cn("-rotate-90 shrink-0", className)}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth} className="stroke-line" />
      {v > 0 ? (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="stroke-brand"
        />
      ) : null}
    </svg>
  );
}
