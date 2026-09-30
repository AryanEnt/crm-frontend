import { cn } from "@/lib/utils";

const NODE = 32;
const PITCH = 80;
const CY = 40;
const GAP = 6;

const OPEN_STAGES = [
  { soft: "fill-stage-1-soft", line: "stroke-stage-1", dot: "fill-stage-1" },
  { soft: "fill-stage-2-soft", line: "stroke-stage-2", dot: "fill-stage-2" },
  { soft: "fill-stage-3-soft", line: "stroke-stage-3", dot: "fill-stage-3" },
  { soft: "fill-stage-4-soft", line: "stroke-stage-4", dot: "fill-stage-4" },
] as const;

const WON = { soft: "fill-stage-won-soft", line: "stroke-stage-won" } as const;

/** Index of the connector the deal marker sits on, and how far along it (0–1). */
const DEAL_CONNECTOR = 2;
const DEAL_PROGRESS = 0.45;

const centerX = (index: number) => NODE / 2 + index * PITCH;

/** Static, decorative pipeline: ordinal stage nodes ending in Won, with one deal part-way through. */
export function PipelineSketch({ className }: { className?: string }) {
  const nodeCount = OPEN_STAGES.length + 1;
  const width = centerX(nodeCount - 1) + NODE / 2;

  const connectors = Array.from({ length: nodeCount - 1 }, (_, i) => ({
    x1: centerX(i) + NODE / 2 + GAP,
    x2: centerX(i + 1) - NODE / 2 - GAP,
  }));
  const active = connectors[DEAL_CONNECTOR];
  const dealX = active.x1 + (active.x2 - active.x1) * DEAL_PROGRESS;

  return (
    <svg
      viewBox={`0 0 ${width} ${CY * 2}`}
      aria-hidden
      focusable="false"
      className={cn("h-auto overflow-visible", className)}
      fill="none"
      strokeLinecap="round"
    >
      {connectors.map((c, i) =>
        i < DEAL_CONNECTOR ? (
          <line key={i} x1={c.x1} x2={c.x2} y1={CY} y2={CY} strokeWidth={1.5} className="stroke-line-strong" />
        ) : i === DEAL_CONNECTOR ? (
          <g key={i}>
            <line x1={c.x1} x2={dealX} y1={CY} y2={CY} strokeWidth={1.5} className="stroke-line-strong" />
            <line x1={dealX} x2={c.x2} y1={CY} y2={CY} strokeWidth={1} strokeDasharray="2 4" className="stroke-line-strong" />
          </g>
        ) : (
          <line key={i} x1={c.x1} x2={c.x2} y1={CY} y2={CY} strokeWidth={1} strokeDasharray="2 4" className="stroke-line-strong" />
        ),
      )}

      {OPEN_STAGES.map((stage, i) => {
        const cx = centerX(i);
        return (
          <g key={stage.dot}>
            <rect
              x={cx - NODE / 2 + 0.5}
              y={CY - NODE / 2 + 0.5}
              width={NODE - 1}
              height={NODE - 1}
              rx={9}
              strokeWidth={1}
              className={cn(stage.soft, stage.line)}
            />
            <circle cx={cx} cy={CY} r={3.5} className={stage.dot} />
          </g>
        );
      })}

      <g>
        <rect
          x={centerX(nodeCount - 1) - NODE / 2 + 0.5}
          y={CY - NODE / 2 + 0.5}
          width={NODE - 1}
          height={NODE - 1}
          rx={9}
          strokeWidth={1}
          className={cn(WON.soft, WON.line)}
        />
        <path
          d={`M${centerX(nodeCount - 1) - 5} ${CY} l3.5 3.5 l6.5 -7`}
          strokeWidth={1.75}
          strokeLinejoin="round"
          className={WON.line}
        />
      </g>

      <circle cx={dealX} cy={CY} r={9} className="fill-brand-soft" />
      <circle cx={dealX} cy={CY} r={4.5} className="fill-brand" />
    </svg>
  );
}
