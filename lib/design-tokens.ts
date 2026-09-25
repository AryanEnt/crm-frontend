import type { StageSlot } from "@/components/ui/stage-rail";

/** Soft + solid class pairs for stage badges (solid text on soft fill). */
export const stageBadgeClass: Record<StageSlot, string> = {
  "1": "bg-stage-1-soft text-stage-1",
  "2": "bg-stage-2-soft text-stage-2",
  "3": "bg-stage-3-soft text-stage-3",
  "4": "bg-stage-4-soft text-stage-4",
  won: "bg-stage-won-soft text-stage-won",
  lost: "bg-stage-lost-soft text-stage-lost",
};

export type PriorityLevel = "low" | "medium" | "high" | "urgent";

export const priorityBadgeClass: Record<PriorityLevel, string> = {
  low: "bg-priority-low-soft text-priority-low",
  medium: "bg-priority-medium-soft text-priority-medium",
  high: "bg-priority-high-soft text-priority-high",
  urgent: "bg-priority-urgent-soft text-priority-urgent",
};

export function priorityFromString(v?: string | null): PriorityLevel {
  const s = (v ?? "").toLowerCase();
  if (s === "urgent") return "urgent";
  if (s === "high") return "high";
  if (s === "low") return "low";
  return "medium";
}
