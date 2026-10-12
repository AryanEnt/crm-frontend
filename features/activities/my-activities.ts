import type { Activity } from "@/lib/api/crm";

export type MyActivityGroups = { overdue: Activity[]; today: Activity[]; upcoming: Activity[] };

const isOpen = (a: Activity) => a.status !== "completed" && a.status !== "cancelled";

/**
 * Splits open work into overdue, the rest of today, and later days. Each activity lands in exactly
 * one group; `hidden` drops ones just marked done before the refetch catches up.
 */
export function groupMyActivities(
  overdue: readonly Activity[],
  scheduled: readonly Activity[],
  dayKeyOf: (a: Activity) => string,
  todayKey: string,
  hidden: ReadonlySet<string> = new Set(),
): MyActivityGroups {
  const show = (a: Activity) => isOpen(a) && !hidden.has(a.id);
  const late = new Map<string, Activity>();
  for (const a of [...overdue, ...scheduled.filter((s) => s.displayStatus === "overdue")]) {
    if (show(a)) late.set(a.id, a);
  }
  const rest = scheduled.filter((a) => show(a) && !late.has(a.id));
  return {
    overdue: [...late.values()].sort((x, y) => (y.dueAt ?? "").localeCompare(x.dueAt ?? "")),
    today: rest.filter((a) => dayKeyOf(a) === todayKey),
    upcoming: rest.filter((a) => dayKeyOf(a) > todayKey),
  };
}
