import { cn } from "@/lib/utils";
import type { StageSlot } from "@/components/ui/stage-rail";

const SLOT_BG: Record<StageSlot, string> = {
  "1": "bg-stage-1",
  "2": "bg-stage-2",
  "3": "bg-stage-3",
  "4": "bg-stage-4",
  won: "bg-stage-won",
  lost: "bg-stage-lost",
};

export type RibbonSegment = {
  id: string;
  label: string;
  value: number;
  slot: StageSlot;
};

const HEIGHT = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
} as const;

function share(value: number, total: number) {
  return total > 0 ? Math.round((Math.max(0, value) / total) * 100) : 0;
}

/**
 * Aurora signature: pipeline as one segmented bar. Each segment's width is its
 * share of the total; color is the ordinal stage slot, so the same stage reads
 * the same everywhere (dashboard hero, board header, record headers).
 */
export function StageRibbon({
  segments,
  size = "md",
  label = "Pipeline by stage",
  formatValue = (v) => String(v),
  className,
}: {
  segments: RibbonSegment[];
  size?: keyof typeof HEIGHT;
  label?: string;
  formatValue?: (value: number) => string;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const summary = segments
    .map((s) => `${s.label} ${formatValue(s.value)} (${share(s.value, total)}%)`)
    .join(", ");

  return (
    <div
      role="img"
      aria-label={`${label}: ${summary || "no value"}`}
      className={cn("flex w-full gap-0.5", HEIGHT[size], className)}
    >
      {total <= 0 ? (
        <span className="flex-1 rounded-[2px] bg-surface-muted" />
      ) : (
        segments.map((s) => (
          <span
            key={s.id}
            title={`${s.label}: ${formatValue(s.value)} · ${share(s.value, total)}%`}
            className={cn(
              "stage-ribbon__seg min-w-1 basis-0 rounded-[2px]",
              SLOT_BG[s.slot],
              s.value <= 0 && "opacity-25",
            )}
            style={{ flexGrow: Math.max(0, s.value) }}
          />
        ))
      )}
    </div>
  );
}

/** Stage name, value and share under a ribbon; the dot repeats the segment color. */
export function StageRibbonLegend({
  segments,
  formatValue = (v) => String(v),
  className,
}: {
  segments: RibbonSegment[];
  formatValue?: (value: number) => string;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  return (
    <ul className={cn("flex flex-wrap gap-x-6 gap-y-2", className)}>
      {segments.map((s) => (
        <li key={s.id} className="min-w-0">
          <div className="flex items-center gap-1.5 text-meta">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-[2px]", SLOT_BG[s.slot])} />
            <span className="truncate">{s.label}</span>
          </div>
          <p className="mt-0.5 pl-3.5 text-numeral-sm">
            {formatValue(s.value)}
            <span className="ml-1.5 text-meta font-normal">{share(s.value, total)}%</span>
          </p>
        </li>
      ))}
    </ul>
  );
}
