import type { PipelineStatus } from "./pipeline-totals.ts";
import { closedRangeLabel, isIsoDate, setIntervalParams, type ClosedRange, type Interval } from "./closed-range.ts";

export type NextActionFilter = "" | "overdue" | "today" | "week" | "none";
export type ClosedSortKey = "name" | "value" | "closed";
export type SortOrder = "asc" | "desc";
export type ClosedView = "board" | "table";

/** Everything the Pipeline page can be filtered by. Mirrors the URL, so views are shareable. */
export type PipelineFilters = {
  status: PipelineStatus;
  q: string;
  next: NextActionFilter;
  owner: string;
  source: string;
  /** Value range in whole currency units; "" when unset. */
  min: string;
  max: string;
  pipeline: string;
  /** Won / Lost only: when the lead closed. Custom dates are YYYY-MM-DD, both inclusive. */
  closed: ClosedRange;
  closedFrom: string;
  closedTo: string;
  /** Won / Lost as a kanban board or a table. */
  view: ClosedView;
  /** Won / Lost sorting, and table paging. */
  sort: ClosedSortKey;
  order: SortOrder;
  page: number;
};

export const DEFAULT_PIPELINE_FILTERS: PipelineFilters = {
  status: "all",
  q: "",
  next: "",
  owner: "",
  source: "",
  min: "",
  max: "",
  pipeline: "",
  closed: "",
  closedFrom: "",
  closedTo: "",
  view: "board",
  sort: "closed",
  order: "desc",
  page: 1,
};

export const isClosedStatus = (s: PipelineStatus): s is "won" | "lost" => s === "won" || s === "lost";

export const CLOSED_SORT_OPTIONS: { value: `${ClosedSortKey}:${SortOrder}`; label: string }[] = [
  { value: "closed:desc", label: "Most recent" },
  { value: "closed:asc", label: "Oldest first" },
  { value: "value:desc", label: "Highest value" },
  { value: "value:asc", label: "Lowest value" },
  { value: "name:asc", label: "Name A–Z" },
  { value: "name:desc", label: "Name Z–A" },
];

export const STATUS_OPTIONS: { value: PipelineStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export const NEXT_ACTION_OPTIONS: { value: NextActionFilter; label: string }[] = [
  { value: "", label: "Any" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "none", label: "None" },
];

/** URL keys owned by the filters; anything else (e.g. leadId) is left alone. */
const FILTER_KEYS = [
  "status",
  "q",
  "next",
  "owner",
  "source",
  "min",
  "max",
  "pipeline",
  "closed",
  "closedFrom",
  "closedTo",
  "view",
  "sort",
  "order",
  "page",
] as const;

const oneOf = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/** A non-negative number as typed, or "" when blank or invalid. */
export function cleanAmount(raw: string | null | undefined): string {
  const s = (raw ?? "").trim().replace(/[,\s$]/g, "");
  if (s === "") return "";
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? String(n) : "";
}

export function parsePipelineFilters(sp: URLSearchParams): PipelineFilters {
  const page = Number(sp.get("page"));
  let min = cleanAmount(sp.get("min"));
  let max = cleanAmount(sp.get("max"));
  if (min !== "" && max !== "" && Number(min) > Number(max)) [min, max] = [max, min];
  let closed = oneOf(sp.get("closed"), ["", "7d", "30d", "90d", "year", "custom"] as const, "");
  let closedFrom = closed === "custom" && isIsoDate(sp.get("closedFrom")) ? sp.get("closedFrom")! : "";
  let closedTo = closed === "custom" && isIsoDate(sp.get("closedTo")) ? sp.get("closedTo")! : "";
  if (closedFrom && closedTo && closedFrom > closedTo) [closedFrom, closedTo] = [closedTo, closedFrom];
  if (closed === "custom" && !closedFrom && !closedTo) closed = "";
  return {
    status: oneOf(sp.get("status"), ["open", "won", "lost", "all"] as const, DEFAULT_PIPELINE_FILTERS.status),
    q: (sp.get("q") ?? "").trim(),
    next: oneOf(sp.get("next"), ["", "overdue", "today", "week", "none"] as const, ""),
    owner: sp.get("owner") ?? "",
    source: sp.get("source") ?? "",
    min,
    max,
    pipeline: sp.get("pipeline") ?? "",
    closed,
    closedFrom,
    closedTo,
    view: oneOf(sp.get("view"), ["board", "table"] as const, "board"),
    sort: oneOf(sp.get("sort"), ["name", "value", "closed"] as const, "closed"),
    order: oneOf(sp.get("order"), ["asc", "desc"] as const, "desc"),
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** Writes the filters into a copy of `base`, leaving defaults out so URLs stay short. */
export function writePipelineFilters(f: PipelineFilters, base: URLSearchParams = new URLSearchParams()): URLSearchParams {
  const out = new URLSearchParams(base);
  for (const key of FILTER_KEYS) out.delete(key);
  const d = DEFAULT_PIPELINE_FILTERS;
  if (f.status !== d.status) out.set("status", f.status);
  if (f.q.trim()) out.set("q", f.q.trim());
  if (f.next) out.set("next", f.next);
  if (f.owner) out.set("owner", f.owner);
  if (f.source) out.set("source", f.source);
  if (f.min) out.set("min", f.min);
  if (f.max) out.set("max", f.max);
  if (f.pipeline) out.set("pipeline", f.pipeline);
  if (f.closed) out.set("closed", f.closed);
  if (f.closed === "custom" && f.closedFrom) out.set("closedFrom", f.closedFrom);
  if (f.closed === "custom" && f.closedTo) out.set("closedTo", f.closedTo);
  if (f.view !== d.view) out.set("view", f.view);
  if (f.sort !== d.sort) out.set("sort", f.sort);
  if (f.order !== d.order) out.set("order", f.order);
  if (f.page > 1) out.set("page", String(f.page));
  return out;
}

/** Filters shared by the board and the Won/Lost tables, so their counts agree. */
function sharedParams(pipelineId: string, f: PipelineFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (pipelineId) p.set("pipelineId", pipelineId);
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.owner) p.set("ownerUserId", f.owner);
  if (f.source) p.set("source", f.source);
  if (f.next) p.set("activity", f.next);
  if (f.min) p.set("minValue", f.min);
  if (f.max) p.set("maxValue", f.max);
  return p;
}

export function boardParams(pipelineId: string, f: PipelineFilters): URLSearchParams {
  return sharedParams(pipelineId, f);
}

const SORT_PARAM: Record<ClosedSortKey, string> = { name: "name", value: "value", closed: "closed" };

/**
 * Won / Lost leads that closed within `interval`, sorted, one page at a time.
 * Next-action is left out: closed leads have no next action to filter on.
 *
 * Won: match by `won_at` (not current stage). Sales Won hands off to Nurturing, so
 * stage/pipeline membership would empty the Won view.
 * Lost: still the Lost stage on this pipeline (no handoff).
 */
export function closedLeadsParams(
  pipelineId: string,
  stageId: string,
  f: PipelineFilters,
  interval: Interval,
  limit: number,
  offset: number,
  outcome: "won" | "lost" = f.status === "won" ? "won" : "lost",
): URLSearchParams {
  const p = sharedParams(outcome === "won" ? "" : pipelineId, { ...f, next: "" });
  if (outcome === "won") {
    p.set("status", "won");
  } else {
    p.set("stageId", stageId);
    p.set("status", "all");
  }
  setIntervalParams(p, interval);
  p.set("sort", SORT_PARAM[f.sort]);
  p.set("order", f.order);
  p.set("limit", String(limit));
  p.set("offset", String(offset));
  return p;
}

/** The Won or Lost table: the closed date filter, sorted and paged. */
export function closedListParams(
  pipelineId: string,
  stageId: string,
  f: PipelineFilters,
  pageSize: number,
  interval: Interval = { from: null, to: null },
  outcome: "won" | "lost" = f.status === "won" ? "won" : "lost",
): URLSearchParams {
  return closedLeadsParams(pipelineId, stageId, f, interval, pageSize, (f.page - 1) * pageSize, outcome);
}

export type FilterChipKey = "q" | "next" | "owner" | "source" | "value" | "closed";
export type FilterChip = { key: FilterChipKey; label: string };

const formatAmount = (v: string) => Number(v).toLocaleString("en-AU");

/** Removable chips for every active filter except status, which has its own control. */
export function activeFilterChips(
  f: PipelineFilters,
  names: { owner?: string; currencySymbol?: string } = {},
): FilterChip[] {
  const chips: FilterChip[] = [];
  const sym = names.currencySymbol ?? "$";
  const closedView = isClosedStatus(f.status);
  if (f.q) chips.push({ key: "q", label: `“${f.q}”` });
  if (closedView && f.closed) {
    chips.push({ key: "closed", label: `${f.status === "won" ? "Won" : "Lost"} ${closedRangeLabel(f)}` });
  }
  if (f.next && !closedView) {
    const label = NEXT_ACTION_OPTIONS.find((o) => o.value === f.next)?.label ?? f.next;
    chips.push({ key: "next", label: `Next action: ${label.toLowerCase()}` });
  }
  if (f.owner) chips.push({ key: "owner", label: `Owner: ${names.owner ?? "selected"}` });
  if (f.source) chips.push({ key: "source", label: `Source: ${f.source}` });
  if (f.min || f.max) {
    const label =
      f.min && f.max
        ? `${sym}${formatAmount(f.min)}–${sym}${formatAmount(f.max)}`
        : f.min
          ? `${sym}${formatAmount(f.min)}+`
          : `Up to ${sym}${formatAmount(f.max)}`;
    chips.push({ key: "value", label: `Value: ${label}` });
  }
  return chips;
}

export function clearFilter(f: PipelineFilters, key: FilterChipKey): PipelineFilters {
  const next = { ...f, page: 1 };
  if (key === "value") return { ...next, min: "", max: "" };
  if (key === "closed") return { ...next, closed: "", closedFrom: "", closedTo: "" };
  return { ...next, [key]: "" };
}

/** Keeps status, pipeline, view and sorting; drops everything that narrows the leads. */
export function clearAllFilters(f: PipelineFilters): PipelineFilters {
  return { ...f, q: "", next: "", owner: "", source: "", min: "", max: "", closed: "", closedFrom: "", closedTo: "", page: 1 };
}

/** Whether anything narrows what the current view shows. */
export function hasNarrowingFilters(f: PipelineFilters): boolean {
  if (isClosedStatus(f.status)) return Boolean(f.q || f.owner || f.source || f.min || f.max || f.closed);
  return Boolean(f.q || f.next || f.owner || f.source || f.min || f.max);
}
