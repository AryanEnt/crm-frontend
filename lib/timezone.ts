/** Format / parse timestamps using the user's configured IANA timezone. */

export function formatInTimezone(
  value: string | Date | null | undefined,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { ...options, timeZone: timeZone || "UTC" }).format(d);
  } catch {
    return new Intl.DateTimeFormat(undefined, options).format(d);
  }
}

export function formatTimeInTimezone(
  value: string | Date | null | undefined,
  timeZone: string,
): string {
  return formatInTimezone(value, timeZone, { hour: "2-digit", minute: "2-digit" });
}

export function formatDateInTimezone(
  value: string | Date | null | undefined,
  timeZone: string,
): string {
  return formatInTimezone(value, timeZone, { year: "numeric", month: "short", day: "numeric" });
}

/** Calendar day key (YYYY-MM-DD) in the given timezone. */
export function dayKeyInTimezone(value: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value);
  } catch {
    return value.toISOString().slice(0, 10);
  }
}

/**
 * Calendar grid cells are browser-local midnight Dates standing for a calendar date,
 * so their day key must come from their own fields, not from a timezone conversion.
 */
export function calendarDayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's date in the given timezone, as a grid cell Date. */
export function todayInTimezone(timeZone: string): Date {
  const [y, m, d] = dayKeyInTimezone(new Date(), timeZone).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function timezoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant a grid cell's calendar date begins in the given timezone. */
export function startOfDayInTimezone(d: Date, timeZone: string): Date {
  const utcMidnight = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  try {
    const guess = utcMidnight - timezoneOffsetMs(new Date(utcMidnight), timeZone || "UTC");
    return new Date(utcMidnight - timezoneOffsetMs(new Date(guess), timeZone || "UTC"));
  } catch {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function commonTimezones(): string[] {
  return [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Kathmandu",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Australia/Sydney",
    "Pacific/Auckland",
  ];
}
