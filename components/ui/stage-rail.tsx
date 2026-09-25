import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type StageSlot = "1" | "2" | "3" | "4" | "won" | "lost";

const SLOT_CSS: Record<StageSlot, string> = {
  "1": "var(--stage-1)",
  "2": "var(--stage-2)",
  "3": "var(--stage-3)",
  "4": "var(--stage-4)",
  won: "var(--stage-won)",
  lost: "var(--stage-lost)",
};

/**
 * Map pipeline stage position (0-based among open stages) + won/lost flags
 * to an ordinal Stage Rail slot.
 */
export function stageSlotFromPipeline(opts: {
  position: number;
  openStageCount: number;
  isWon?: boolean;
  isLost?: boolean;
}): StageSlot {
  if (opts.isWon) return "won";
  if (opts.isLost) return "lost";
  const n = Math.max(opts.openStageCount, 1);
  const idx = Math.min(Math.max(opts.position, 0), n - 1);
  const bucket = Math.min(3, Math.floor((idx / n) * 4)) + 1;
  return String(bucket) as StageSlot;
}

export type StageRailProps = {
  slot: StageSlot;
  /** 0–100 time-in-stage progress; ignored for won/lost */
  fillPercent?: number;
  /** Brief pulse after win transition */
  wonPulse?: boolean;
  className?: string;
};

/**
 * Aurora signature: 3px leading stage color rail.
 * Place inside a `relative` card/row; rail pins to the leading edge.
 */
export function StageRail({
  slot,
  fillPercent = 0,
  wonPulse,
  className,
}: StageRailProps) {
  const color = SLOT_CSS[slot];
  const showFill = slot !== "won" && slot !== "lost";
  const clamped = Math.min(100, Math.max(0, fillPercent));

  return (
    <span
      className={cn("stage-rail", wonPulse && slot === "won" && "stage-rail--won-pulse", className)}
      style={
        {
          "--stage-rail-color": color,
          "--stage-rail-fill": showFill ? `${clamped}%` : "0%",
        } as CSSProperties
      }
      aria-hidden
    >
      {showFill ? <span className="stage-rail__fill" /> : null}
    </span>
  );
}
