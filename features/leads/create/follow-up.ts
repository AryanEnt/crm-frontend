export type FollowUpPreset = "tomorrow" | "in3days" | "nextweek";

export const FOLLOW_UP_PRESETS: { value: FollowUpPreset; label: string }[] = [
  { value: "tomorrow", label: "Tomorrow" },
  { value: "in3days", label: "In 3 days" },
  { value: "nextweek", label: "Next week" },
];

/**
 * Follow-ups default to 9:00 in the user's time zone. Form values are wall-clock
 * strings in that zone; `zonedInputToIso` turns them into an instant on submit.
 */
export const FOLLOW_UP_HOUR = 9;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The local date and time a shortcut stands for. "Next week" is the Monday after
 * this one, so it never lands sooner than "In 3 days" would on a Friday.
 */
export function resolveFollowUp(preset: FollowUpPreset, now: Date = new Date(), hour = FOLLOW_UP_HOUR): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0);
  if (preset === "tomorrow") d.setDate(d.getDate() + 1);
  else if (preset === "in3days") d.setDate(d.getDate() + 3);
  else d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d;
}

/** "YYYY-MM-DDTHH:mm" in local wall-clock time, the form value for follow-ups. */
export function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Tue 7 Oct, 9:00". */
export function formatFollowUp(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${d.getHours()}:${pad(d.getMinutes())}`;
}

/** Which shortcut, if any, produced this value; lets the chip stay selected. */
export function matchPreset(value: string, now: Date = new Date()): FollowUpPreset | null {
  if (!value) return null;
  for (const { value: preset } of FOLLOW_UP_PRESETS) {
    if (toLocalInput(resolveFollowUp(preset, now)) === value) return preset;
  }
  return null;
}

/** Keeps the chosen day and swaps in a new "HH:mm"; used by the time field after "Pick date". */
export function withTime(value: string, time: string): string {
  const d = fromLocalInput(value);
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!d || !m) return value;
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return toLocalInput(d);
}

/** A picked calendar day at the default hour. */
export function atDefaultHour(day: Date, hour = FOLLOW_UP_HOUR): string {
  return toLocalInput(new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0, 0));
}

function wallClockParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour") % 24, min: get("minute"), s: get("second") };
}

function validZone(timeZone: string | undefined): timeZone is string {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The current wall-clock time in `timeZone`, as a plain Date whose local fields
 * carry that time. Feed it to `resolveFollowUp` and `matchPreset`.
 */
export function nowInZone(timeZone: string | undefined, now: Date = new Date()): Date {
  if (!validZone(timeZone)) return now;
  const p = wallClockParts(now, timeZone);
  return new Date(p.y, p.m - 1, p.d, p.h, p.min, p.s);
}

/** A stored instant as the "YYYY-MM-DDTHH:mm" form value, in `timeZone`. */
export function isoToZonedInput(iso: string | null | undefined, timeZone: string | undefined): string {
  if (!iso) return "";
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "";
  return toLocalInput(nowInZone(timeZone, instant));
}

/** "YYYY-MM-DDTHH:mm" read as wall-clock time in `timeZone`, as an ISO instant. */
export function zonedInputToIso(value: string, timeZone: string | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  if (!validZone(timeZone)) return fromLocalInput(value)?.toISOString() ?? null;
  const target = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!);
  const offsetAt = (instant: number) => {
    const p = wallClockParts(new Date(instant), timeZone);
    return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - instant;
  };
  // Two passes settle the offset when the guess and the answer straddle a DST change.
  let instant = target - offsetAt(target);
  instant = target - offsetAt(instant);
  return new Date(instant).toISOString();
}
