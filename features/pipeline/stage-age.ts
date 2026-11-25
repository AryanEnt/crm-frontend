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

export type StageAgeOpts = {
  closed?: boolean;
  now?: number;
  /**
   * File Delivered: age starts at this due date (not stage entry).
   * Before the due date, elapsed time stays at zero.
   */
  dueAt?: string | null;
  /** File Delivered: when set, force green and freeze age at this instant. */
  emailSentAt?: string | null;
};

/** Matches backend attention SLA thresholds: warn at 80%, over at 100%. */
export function stageAge(
  stageEnteredAt: string | null | undefined,
  slaHours: number | null | undefined,
  opts: StageAgeOpts = {},
): StageAge {
  const wallNow = opts.now ?? Date.now();
  const sentMs = opts.emailSentAt ? new Date(opts.emailSentAt).getTime() : Number.NaN;
  const frozen = Number.isFinite(sentMs);
  const now = frozen ? sentMs : wallNow;

  const dueMs = opts.dueAt ? new Date(opts.dueAt).getTime() : Number.NaN;
  const enteredMs = stageEnteredAt ? new Date(stageEnteredAt).getTime() : Number.NaN;
  const anchorMs = Number.isFinite(dueMs) ? dueMs : enteredMs;

  // Before the due date (and not yet emailed), countdown has not started.
  if (!frozen && Number.isFinite(dueMs) && wallNow < dueMs) {
    return { tone: "ok", days: 0, hours: 0, hoursPart: 0, fillPercent: 0 };
  }

  const anchorIso = Number.isFinite(anchorMs) ? new Date(anchorMs).toISOString() : stageEnteredAt;
  const days = daysSince(anchorIso, now);
  const hours = Number.isFinite(anchorMs) ? Math.max(0, Math.floor((now - anchorMs) / 3_600_000)) : 0;
  const hoursPart = hours % 24;

  if (frozen) {
    return { tone: "ok", days, hours, hoursPart, fillPercent: Math.min(100, days > 0 || hours > 0 ? 40 : 0) };
  }

  if (opts.closed || !slaHours || slaHours <= 0) {
    return { tone: "none", days, hours, hoursPart, fillPercent: 0 };
  }

  const exactHours = Number.isFinite(anchorMs) ? Math.max(0, (now - anchorMs) / 3_600_000) : 0;
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
