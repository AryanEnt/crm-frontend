import {
  DEFAULT_PIPELINE_FILTERS,
  parsePipelineFilters,
  snapshotForDefault,
  writePipelineFilters,
  type PipelineFilters,
  type StageBoardSort,
} from "./pipeline-filters";

const PREFIX = "aurora.pipeline.defaultFilters.";

export type PipelineDefaultBundle = {
  filters: PipelineFilters | null;
  /** Per pipeline, per stage column sort overrides. */
  stageSorts: Record<string, Record<string, StageBoardSort>>;
};

type Cache = { key: string; raw: string | null; value: PipelineDefaultBundle };

let cache: Cache | null = null;

function storageKey(userId: string): string {
  return PREFIX + userId;
}

function parseFilters(value: unknown): PipelineFilters | null {
  if (!value || typeof value !== "object") return null;
  const merged = { ...DEFAULT_PIPELINE_FILTERS, ...(value as Partial<PipelineFilters>) };
  return parsePipelineFilters(writePipelineFilters(snapshotForDefault(merged)));
}

function parseStageSorts(value: unknown): Record<string, Record<string, StageBoardSort>> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, Record<string, StageBoardSort>> = {};
  for (const [pipelineId, stages] of Object.entries(value as Record<string, unknown>)) {
    if (!pipelineId || !stages || typeof stages !== "object") continue;
    const inner: Record<string, StageBoardSort> = {};
    for (const [stageId, sort] of Object.entries(stages as Record<string, unknown>)) {
      if (!stageId || !sort || typeof sort !== "object") continue;
      const s = sort as { sort?: string; order?: string };
      if (
        (s.sort === "value" || s.sort === "days" || s.sort === "time" || s.sort === "priority") &&
        (s.order === "asc" || s.order === "desc")
      ) {
        inner[stageId] = { sort: s.sort, order: s.order };
      }
    }
    if (Object.keys(inner).length) out[pipelineId] = inner;
  }
  return out;
}

function parseBundle(raw: string | null): PipelineDefaultBundle {
  const empty: PipelineDefaultBundle = { filters: null, stageSorts: {} };
  if (!raw) return empty;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return empty;
    const rec = value as Record<string, unknown>;
    if ("filters" in rec) {
      return {
        filters: parseFilters(rec.filters),
        stageSorts: parseStageSorts(rec.stageSorts),
      };
    }
    return { filters: parseFilters(value), stageSorts: {} };
  } catch {
    return empty;
  }
}

function readRaw(userId: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

function readBundle(userId: string): PipelineDefaultBundle {
  const key = storageKey(userId);
  const raw = readRaw(userId);
  if (cache && cache.key === key && cache.raw === raw) return cache.value;
  const value = parseBundle(raw);
  cache = { key, raw, value };
  return value;
}

function writeBundle(userId: string, bundle: PipelineDefaultBundle): void {
  const key = storageKey(userId);
  const raw = JSON.stringify({
    filters: bundle.filters,
    stageSorts: bundle.stageSorts,
  });
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    // ignore quota / private mode
  }
  cache = { key, raw, value: bundle };
}

export function readPipelineDefaultFilters(userId: string | null | undefined): PipelineFilters | null {
  if (!userId) return null;
  return readBundle(userId).filters;
}

export function writePipelineDefaultFilters(userId: string, filters: PipelineFilters): PipelineFilters {
  const next = snapshotForDefault(filters);
  const prev = readBundle(userId);
  writeBundle(userId, { filters: next, stageSorts: prev.stageSorts });
  return next;
}

export function readPipelineStageSorts(
  userId: string | null | undefined,
  pipelineId: string,
): Record<string, StageBoardSort> {
  if (!userId || !pipelineId) return {};
  return readBundle(userId).stageSorts[pipelineId] ?? {};
}

export function writePipelineStageSorts(
  userId: string,
  pipelineId: string,
  sorts: Record<string, StageBoardSort>,
): void {
  if (!pipelineId) return;
  const prev = readBundle(userId);
  const stageSorts = { ...prev.stageSorts };
  if (Object.keys(sorts).length === 0) delete stageSorts[pipelineId];
  else stageSorts[pipelineId] = sorts;
  writeBundle(userId, { filters: prev.filters, stageSorts });
}
