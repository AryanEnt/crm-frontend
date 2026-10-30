import type { LeadBoard, LeadBoardCard, LeadBoardStage } from "@/lib/api/crm";

/** Fixed id of the post-win Nurturing pipeline (migration 000038). */
export const NURTURING_PIPELINE_ID = "55555555-5555-5555-5555-555555555505";

export function isNurturingPipeline(pipelineId: string | null | undefined): boolean {
  return pipelineId === NURTURING_PIPELINE_ID;
}

/** Pending optimistic moves: lead id -> target stage id. */
export type PendingMoves = Record<string, string>;

export type MoveIntent =
  | { kind: "noop" }
  | { kind: "move" }
  | { kind: "lost_reason" }
  /** Sales Won collects the document send deadline before the move + Nurturing handoff. */
  | { kind: "won_deadline" }
  /** Closed (Won/Lost) leads need an explicit reopen; `lostReason` is also needed when the target is Lost. */
  | { kind: "reopen"; lostReason: boolean };

export function isClosedStatus(status: string): boolean {
  return status === "won" || status === "lost";
}

export function statusForStage(stage: Pick<LeadBoardStage, "isWon" | "isLost">): string {
  if (stage.isWon) return "won";
  if (stage.isLost) return "lost";
  return "open";
}

export function findCard(board: LeadBoard, leadId: string): { card: LeadBoardCard; stage: LeadBoardStage } | null {
  for (const stage of board.stages) {
    const card = stage.leads.find((l) => l.id === leadId);
    if (card) return { card, stage };
  }
  return null;
}

/** What a drop (or keyboard move) of `card` onto `to` requires before calling the API. */
export function classifyMove(
  card: Pick<LeadBoardCard, "stageId" | "status">,
  to: Pick<LeadBoardStage, "id" | "isLost" | "isWon">,
  opts?: { pipelineId?: string | null },
): MoveIntent {
  if (card.stageId === to.id) return { kind: "noop" };
  if (isClosedStatus(card.status)) return { kind: "reopen", lostReason: to.isLost };
  if (to.isLost) return { kind: "lost_reason" };
  // Nurturing "Complete" is isWon in the schema, but it is not a sales win — no doc deadline.
  if (to.isWon && !isNurturingPipeline(opts?.pipelineId)) return { kind: "won_deadline" };
  return { kind: "move" };
}

/**
 * Moves a card to the top of another column, keeping per-column counts and value
 * totals in step. Returns the same board when the lead or stage is not on it.
 */
export function moveCard(
  board: LeadBoard,
  leadId: string,
  toStageId: string,
  opts: { now?: string; lostReason?: string } = {},
): LeadBoard {
  const hit = findCard(board, leadId);
  const target = board.stages.find((s) => s.id === toStageId);
  if (!hit || !target || hit.stage.id === toStageId) return board;
  const now = opts.now ?? new Date().toISOString();
  const value = hit.card.potentialValue ?? 0;
  const status = statusForStage(target);
  const moved: LeadBoardCard = {
    ...hit.card,
    stageId: toStageId,
    status,
    stageEnteredAt: now,
    wonAt: status === "won" ? now : null,
    lostAt: status === "lost" ? now : null,
    lostReason: status === "lost" ? (opts.lostReason ?? hit.card.lostReason) : "",
  };
  return {
    ...board,
    stages: board.stages.map((s) => {
      if (s.id === hit.stage.id) {
        return {
          ...s,
          count: Math.max(0, s.count - 1),
          totalValue: s.totalValue - value,
          leads: s.leads.filter((l) => l.id !== leadId),
        };
      }
      if (s.id === toStageId) {
        return { ...s, count: s.count + 1, totalValue: s.totalValue + value, leads: [moved, ...s.leads] };
      }
      return s;
    }),
  };
}

/**
 * Re-applies in-flight moves on top of fresh server data, so a background refetch
 * that lands mid-move cannot draw a card back in its old column.
 */
export function applyPendingMoves(board: LeadBoard, pending: PendingMoves): LeadBoard {
  let out = board;
  for (const [leadId, stageId] of Object.entries(pending)) {
    out = moveCard(out, leadId, stageId);
  }
  return out;
}

/** Appends the next page of a column, skipping cards already shown. */
export function appendStagePage(
  board: LeadBoard,
  stageId: string,
  page: { leads: LeadBoardCard[]; hasMore: boolean },
): LeadBoard {
  return {
    ...board,
    stages: board.stages.map((s) => {
      if (s.id !== stageId) return s;
      const seen = new Set(s.leads.map((l) => l.id));
      return { ...s, hasMore: page.hasMore, leads: [...s.leads, ...page.leads.filter((l) => !seen.has(l.id))] };
    }),
  };
}

/** Neighbouring column for keyboard moves; null at either end. */
export function adjacentStageId(board: LeadBoard, stageId: string, direction: -1 | 1): string | null {
  const idx = board.stages.findIndex((s) => s.id === stageId);
  if (idx < 0) return null;
  return board.stages[idx + direction]?.id ?? null;
}

export type LeadFilters = {
  search: string;
  ownerUserId: string;
  salesExecutiveId: string;
  teamId: string;
  stageId: string;
  priority: string;
  source: string;
  activity: string;
  tag: string;
  /** Exact lead.country; "(Unknown)" matches blank. */
  country: string;
  createdFrom: string;
  createdTo: string;
};

export const EMPTY_LEAD_FILTERS: LeadFilters = {
  search: "",
  ownerUserId: "",
  salesExecutiveId: "",
  teamId: "",
  stageId: "",
  priority: "",
  source: "",
  activity: "",
  tag: "",
  country: "",
  createdFrom: "",
  createdTo: "",
};

/** Query params shared by the board and the list; empty filters are left out. */
export function leadFilterParams(pipelineId: string, f: LeadFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (pipelineId) p.set("pipelineId", pipelineId);
  const search = f.search.trim();
  if (search) p.set("q", search);
  if (f.salesExecutiveId) p.set("salesExecutiveId", f.salesExecutiveId);
  if (f.ownerUserId) p.set("ownerUserId", f.ownerUserId);
  if (f.teamId) p.set("teamId", f.teamId);
  if (f.stageId) p.set("stageId", f.stageId);
  if (f.priority) p.set("priority", f.priority);
  if (f.source) p.set("source", f.source);
  if (f.activity) p.set("activity", f.activity);
  const tag = f.tag.trim();
  if (tag) p.set("tag", tag);
  if (f.country.trim()) p.set("country", f.country.trim());
  if (f.createdFrom.trim()) p.set("createdFrom", f.createdFrom.trim());
  if (f.createdTo.trim()) p.set("createdTo", f.createdTo.trim());
  return p;
}

export function activeFilterCount(f: LeadFilters): number {
  return (Object.keys(f) as (keyof LeadFilters)[]).filter((k) => f[k].trim() !== "").length;
}
