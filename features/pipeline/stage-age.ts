import { daysSince } from "../leads/lead-format.ts";

export type StageAgeTone = "none" | "ok" | "warn" | "over";

export type StageAge = {
  tone: StageAgeTone;
  /** Whole calendar days since stage entry (floor). */
  days: number;
  /** Whole hours since stage entry (floor); used for day+hour labels. */
  hours: number;
  /** Hours past whole days (0–23). */
  hoursPart: number;
  fillPercent: number;
};

/** Matches backend attention SLA thresholds: warn at 80%, over at 100%. */
export function stageAge(
  stageEnteredAt: string | null | undefined,
  slaHours: number | null | undefined,
  opts: { closed?: boolean; now?: number } = {},
): StageAge {
  const now = opts.now ?? Date.now();
  const days = daysSince(stageEnteredAt, now);
  const enteredMs = stageEnteredAt ? new Date(stageEnteredAt).getTime() : Number.NaN;
  const hours = Number.isFinite(enteredMs) ? Math.max(0, Math.floor((now - enteredMs) / 3_600_000)) : 0;
  const hoursPart = hours % 24;

  if (opts.closed || !slaHours || slaHours <= 0) {
    return { tone: "none", days, hours, hoursPart, fillPercent: 0 };
  }

  const exactHours = Number.isFinite(enteredMs) ? Math.max(0, (now - enteredMs) / 3_600_000) : 0;
  const ratio = exactHours / slaHours;
  const fillPercent = Math.min(100, Math.round(ratio * 100));
  // At the SLA limit the card goes red so a lead at the limit is clearly rotten.
  if (ratio >= 1) return { tone: "over", days, hours, hoursPart, fillPercent: 100 };
  if (ratio > 0.8) return { tone: "warn", days, hours, hoursPart, fillPercent };
  return { tone: "ok", days, hours, hoursPart, fillPercent };
}

/**
 * Pipeline card elapsed label, e.g. "1 Day 2 Hours", "2 Days 5 Hours".
 * Always includes hours so aging is visible below one day.
 */
export function formatStageAgeLabel(age: Pick<StageAge, "days" | "hoursPart" | "hours">): string {
  if (age.hours < 1) return "0 Hours";
  const dayPart =
    age.days > 0 ? `${age.days} Day${age.days === 1 ? "" : "s"}` : null;
  const hourPart = `${age.hoursPart} Hour${age.hoursPart === 1 ? "" : "s"}`;
  return dayPart ? `${dayPart} ${hourPart}` : hourPart;
}
