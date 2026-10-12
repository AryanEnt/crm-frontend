import { nowInZone, zonedInputToIso } from "../leads/create/follow-up.ts";

/** "Closed" date filter for the Won and Lost views. */
export type ClosedRange = "" | "7d" | "30d" | "90d" | "year" | "custom";

export const CLOSED_RANGE_OPTIONS: { value: ClosedRange; label: string }[] = [
  { value: "", label: "Any time" },
  { value: "7d", label: "Past 7 days" },
  { value: "30d", label: "Past 30 days" },
  { value: "90d", label: "Past 90 days" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom dates" },
];

/** Half-open [from, to) in epoch ms; null means unbounded. */
export type Interval = { from: number | null; to: number | null };

const DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isIsoDate = (v: string | null | undefined): v is string =>
  !!v && ISO_DATE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/** "2026-10-31" -> "2026-11-01". */
export function nextIsoDate(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + DAY).toISOString().slice(0, 10);
}

/** Midnight at the start of `date` where the user is. */
function startOfDay(date: string, timeZone?: string): number | null {
  const iso = zonedInputToIso(`${date}T00:00`, timeZone);
  return iso ? Date.parse(iso) : null;
}

export function closedInterval(
  f: { closed: ClosedRange; closedFrom: string; closedTo: string },
  now: number,
  timeZone?: string,
): Interval {
  switch (f.closed) {
    case "7d":
      return { from: now - 7 * DAY, to: null };
    case "30d":
      return { from: now - 30 * DAY, to: null };
    case "90d":
      return { from: now - 90 * DAY, to: null };
    case "year":
      return { from: startOfDay(`${nowInZone(timeZone, new Date(now)).getFullYear()}-01-01`, timeZone), to: null };
    case "custom":
      return {
        from: isIsoDate(f.closedFrom) ? startOfDay(f.closedFrom, timeZone) : null,
        // The end date is inclusive, so the range runs to the following midnight.
        to: isIsoDate(f.closedTo) ? startOfDay(nextIsoDate(f.closedTo), timeZone) : null,
      };
    default:
      return { from: null, to: null };
  }
}

export type ClosedColumn = { id: string; label: string; interval: Interval };

/** Kanban columns for closed leads, newest first, by how long ago they closed. */
const BUCKETS: { id: string; label: string; fromDays: number | null; toDays: number }[] = [
  { id: "week", label: "Past 7 days", fromDays: 7, toDays: 0 },
  { id: "month", label: "8–30 days ago", fromDays: 30, toDays: 7 },
  { id: "quarter", label: "1–3 months ago", fromDays: 90, toDays: 30 },
  { id: "older", label: "Over 3 months ago", fromDays: null, toDays: 90 },
];

const later = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));
const earlier = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.min(a, b));

/** The age columns that overlap the date filter, each narrowed to it. */
export function closedColumns(range: Interval, now: number): ClosedColumn[] {
  const out: ClosedColumn[] = [];
  for (const b of BUCKETS) {
    const bucket: Interval = {
      from: b.fromDays === null ? null : now - b.fromDays * DAY,
      // The newest column is open-ended, so a lead closed after the page loaded still shows.
      to: b.toDays === 0 ? null : now - b.toDays * DAY,
    };
    const interval = { from: later(bucket.from, range.from), to: earlier(bucket.to, range.to) };
    if (interval.from !== null && interval.to !== null && interval.from >= interval.to) continue;
    out.push({ id: b.id, label: b.label, interval });
  }
  return out;
}

export function setIntervalParams(p: URLSearchParams, i: Interval): URLSearchParams {
  if (i.from !== null) p.set("closedFrom", new Date(i.from).toISOString());
  if (i.to !== null) p.set("closedTo", new Date(i.to).toISOString());
  return p;
}

const SHORT = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (date: string) => SHORT.format(new Date(`${date}T00:00:00Z`));

/** "past 30 days", "1 Oct 2026 – 5 Oct 2026", "since 1 Oct 2026". */
export function closedRangeLabel(f: { closed: ClosedRange; closedFrom: string; closedTo: string }): string {
  if (f.closed !== "custom") return (CLOSED_RANGE_OPTIONS.find((o) => o.value === f.closed)?.label ?? "Any time").toLowerCase();
  if (f.closedFrom && f.closedTo) return f.closedFrom === f.closedTo ? fmt(f.closedFrom) : `${fmt(f.closedFrom)} – ${fmt(f.closedTo)}`;
  if (f.closedFrom) return `since ${fmt(f.closedFrom)}`;
  if (f.closedTo) return `up to ${fmt(f.closedTo)}`;
  return "any time";
}
