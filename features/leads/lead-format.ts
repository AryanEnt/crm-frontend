import { dayKeyInTimezone, formatInTimezone, resolveTimezone } from "../../lib/timezone.ts";

const DAY_MS = 86_400_000;

const MONEY_LOCALE = "en-AU";

/** Canonical display names for common residence countries (case-insensitive lookup). */
const COUNTRY_LABELS = new Map(
  [
    "Australia",
    "Nepal",
    "India",
    "New Zealand",
    "United Kingdom",
    "United States",
    "Canada",
    "Philippines",
    "China",
    "Sri Lanka",
    "Bangladesh",
    "Pakistan",
    "Indonesia",
    "Vietnam",
    "South Africa",
  ].map((name) => [name.toLowerCase(), name]),
);

/** Table / chip label for `lead.country`; blank → em dash. */
export function formatLeadCountry(country?: string | null): string {
  const raw = country?.trim() ?? "";
  if (!raw || raw === "(Unknown)" || raw === "(none)") return "—";
  return COUNTRY_LABELS.get(raw.toLowerCase()) ?? raw;
}

/** Filter / summary label; keeps "(Unknown)" readable. */
export function countryFilterLabel(country: string): string {
  const raw = country.trim();
  if (!raw) return "All Countries";
  if (raw === "(Unknown)" || raw === "(none)") return "Unknown";
  return formatLeadCountry(raw);
}

export function formatLeadCount(total: number): string {
  const n = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  return `${n.toLocaleString(MONEY_LOCALE)} ${n === 1 ? "lead" : "leads"}`;
}

function resolvedTimeZone(timeZone?: string): string {
  return resolveTimezone(timeZone);
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

/** Short board/list label for a document send-by date. */
export function formatDocumentDeadline(
  iso: string | null | undefined,
  timeZone?: string,
  now: Date = new Date(),
): string {
  if (!iso) return "No document deadline";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "No document deadline";
  const zone = resolvedTimeZone(timeZone);
  const tone = nextActionTone(iso, zone, now);
  const day = formatInTimezone(at, zone, { day: "numeric", month: "short", year: "numeric" });
  if (tone === "overdue") return `Docs overdue · ${day}`;
  if (tone === "today") return "Docs due today";
  return `Docs due ${day}`;
}

/** Detail-panel copy: headline + supporting line for the send-by date. */
export function documentDeadlineCopy(
  iso: string,
  timeZone?: string,
  now: Date = new Date(),
): { headline: string; detail: string; tone: NextActionTone } {
  const at = new Date(iso);
  const zone = resolvedTimeZone(timeZone);
  const tone = nextActionTone(iso, zone, now);
  const day = formatInTimezone(at, zone, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  if (tone === "overdue") {
    const days = Math.max(1, Math.ceil((now.getTime() - at.getTime()) / DAY_MS));
    return {
      tone,
      headline: "Document deadline passed",
      detail: `Was due ${day} · ${days} day${days === 1 ? "" : "s"} overdue`,
    };
  }
  if (tone === "today") {
    return { tone, headline: "Documents due today", detail: `Send by end of day · ${day}` };
  }
  const days = Math.max(1, Math.ceil((at.getTime() - now.getTime()) / DAY_MS));
  return {
    tone,
    headline: "Documents to send",
    detail: `Send by ${day} · ${days} day${days === 1 ? "" : "s"} left`,
  };
}
