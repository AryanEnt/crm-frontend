import type { QueryClient } from "@tanstack/react-query";
import type { Activity } from "@/lib/api/crm";

/** "Ram moved to Contacted" when completing the activity moved its lead forward. */
export function leadMovedMessage(a: Pick<Activity, "leadName" | "leadMovedTo"> | undefined): string | undefined {
  if (!a?.leadMovedTo) return undefined;
  return `${a.leadName || "Lead"} moved to ${a.leadMovedTo.stageName}`;
}

/** Summary for several completions at once, e.g. "3 leads moved to Contacted". */
export function bulkLeadMovedMessage(results: readonly Pick<Activity, "leadName" | "leadMovedTo">[]): string | undefined {
  const moved = results.filter((a) => a.leadMovedTo);
  if (moved.length === 0) return undefined;
  if (moved.length === 1) return leadMovedMessage(moved[0]);
  const stages = new Set(moved.map((a) => a.leadMovedTo!.stageName));
  const where = stages.size === 1 ? `to ${[...stages][0]}` : "forward";
  return `${moved.length} leads moved ${where}`;
}

export function invalidateLeadViews(qc: QueryClient, leadId?: string | null) {
  void qc.invalidateQueries({ queryKey: ["lead-board"] });
  void qc.invalidateQueries({ queryKey: ["leads"] });
  void qc.invalidateQueries({ queryKey: ["lead-insights"] });
  if (leadId) void qc.invalidateQueries({ queryKey: ["lead", leadId] });
}
