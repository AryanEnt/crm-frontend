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
