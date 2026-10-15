import { dayKeyInTimezone, formatInTimezone } from "../../lib/timezone.ts";

const DAY_MS = 86_400_000;

const MONEY_LOCALE = "en-AU";

function resolvedTimeZone(timeZone?: string): string {
  return timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Whole-unit currency in en-AU ("$12,500" for AUD); plain number when the code is not a valid ISO currency. */
export function formatLeadMoney(value: number | null | undefined, currency = "AUD"): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  try {
    return new Intl.NumberFormat(MONEY_LOCALE, {
      style: "currency",
      currency: currency || "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value));
  } catch {
    return Math.round(Number(value)).toLocaleString(MONEY_LOCALE);
  }
}

/** Compact value for column headers and KPIs, e.g. "$12.5K". */
export function formatLeadMoneyCompact(value: number | null | undefined, currency = "AUD"): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  try {
    return new Intl.NumberFormat(MONEY_LOCALE, {
      style: "currency",
      currency: currency || "AUD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(Number(value));
  } catch {
    return Math.round(Number(value)).toLocaleString(MONEY_LOCALE);
  }
}

export function daysSince(iso: string | null | undefined, now: number = Date.now()): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}

export type NextActionTone = "none" | "overdue" | "today" | "upcoming";

/** How urgent the next scheduled action is, relative to the viewer's day. */
export function nextActionTone(
  iso: string | null | undefined,
  timeZone?: string,
  now: Date = new Date(),
): NextActionTone {
  if (!iso) return "none";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "none";
  if (at < now) return "overdue";
  const zone = resolvedTimeZone(timeZone);
  return dayKeyInTimezone(at, zone) === dayKeyInTimezone(now, zone) ? "today" : "upcoming";
}

export function formatNextAction(
  iso: string | null | undefined,
  timeZone?: string,
  now: Date = new Date(),
): string {
  if (!iso) return "No next action";
  const at = new Date(iso);
  const zone = resolvedTimeZone(timeZone);
  const tone = nextActionTone(iso, zone, now);
  const time = formatInTimezone(at, zone, { hour: "numeric", minute: "2-digit" });
  if (tone === "today") return `Today ${time}`;
  const day = formatInTimezone(at, zone, { day: "numeric", month: "short" });
  if (tone === "overdue") return `Overdue · ${day}`;
  return `${day} · ${time}`;
}
