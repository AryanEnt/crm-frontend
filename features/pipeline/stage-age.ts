import { daysSince } from "../leads/lead-format.ts";

export type StageAgeTone = "none" | "ok" | "warn" | "over";

/** Matches backend attention SLA thresholds: warn at 80%, over at 100%. */
export function stageAge(
  stageEnteredAt: string | null | undefined,
  slaHours: number | null | undefined,
  opts: { closed?: boolean; now?: number } = {},
): { tone: StageAgeTone; days: number; fillPercent: number } {
  const days = daysSince(stageEnteredAt, opts.now);
  if (opts.closed || !slaHours || slaHours <= 0) {
    return { tone: "none", days, fillPercent: 0 };
  }
  const enteredMs = stageEnteredAt ? new Date(stageEnteredAt).getTime() : Number.NaN;
  const hours = Number.isFinite(enteredMs)
    ? Math.max(0, ((opts.now ?? Date.now()) - enteredMs) / 3_600_000)
    : 0;
  const ratio = hours / slaHours;
  const fillPercent = Math.min(100, Math.round(ratio * 100));
  // At the SLA limit the card goes red so a 5-day lead on day 5 is clearly overdue.
  if (ratio >= 1) return { tone: "over", days, fillPercent: 100 };
  if (ratio > 0.8) return { tone: "warn", days, fillPercent };
  return { tone: "ok", days, fillPercent };
}
