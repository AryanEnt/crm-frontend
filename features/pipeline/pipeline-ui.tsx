import type { CSSProperties } from "react";
import { stageSlotFromPipeline, type StageSlot } from "@/components/ui/stage-rail";
import type { LeadBoardStage } from "@/lib/api/crm";
import { cn } from "@/lib/utils";
import { avatarTone, initials, type AvatarTone } from "./pipeline-format";

/** Ordinal stage slot, shared with the deals board: open stages spread over 1–4, then Won and Lost. */
export function stageSlot(stage: Pick<LeadBoardStage, "id" | "isWon" | "isLost">, stages: LeadBoardStage[]): StageSlot {
  const open = stages.filter((s) => !s.isWon && !s.isLost);
  return stageSlotFromPipeline({
    position: Math.max(0, open.findIndex((s) => s.id === stage.id)),
    openStageCount: open.length,
    isWon: stage.isWon,
    isLost: stage.isLost,
  });
}

/**
 * Exposes a slot's tokens as `--col-stage` (solid), `--col-stage-ink` (text on light
 * surfaces) and `--col-stage-soft` (tint), for everything inside a stage column.
 */
export function stageVars(slot: StageSlot): CSSProperties {
  return {
    "--col-stage": `var(--stage-${slot})`,
    "--col-stage-ink": `var(--stage-${slot}-ink, var(--stage-${slot}))`,
    "--col-stage-soft": `var(--stage-${slot}-soft)`,
  } as CSSProperties;
}

export function StageDot({ slot, className }: { slot: StageSlot; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ backgroundColor: `var(--stage-${slot})` }}
      className={cn("size-2 shrink-0 rounded-full", className)}
    />
  );
}

const AVATAR_BG: Record<AvatarTone, string> = {
  1: "bg-avatar-1",
  2: "bg-avatar-2",
  3: "bg-avatar-3",
  4: "bg-avatar-4",
  5: "bg-avatar-5",
};

export function OwnerAvatar({
  id,
  name,
  size = "sm",
  className,
}: {
  id?: string | null;
  name: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  const label = name ? `Owner: ${name}` : "Unassigned";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-avatar-ink",
        size === "sm" ? "size-6 text-[0.625rem]" : "size-7 text-[0.6875rem]",
        name ? AVATAR_BG[avatarTone(id || name)] : "border border-dashed border-line bg-surface text-ink-muted",
        className,
      )}
    >
      {name ? initials(name) : "–"}
    </span>
  );
}
