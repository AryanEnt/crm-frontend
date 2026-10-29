/** The column aggregates the board API returns for every stage (all pages, not just loaded cards). */
export type StageAggregate = {
  isWon: boolean;
  isLost: boolean;
  count: number;
  totalValue: number | string;
  /** Stage win probability, 0–100. */
  probability: number | string;
};

export type PipelineTotals = {
  openCount: number;
  openValue: number;
  /** Sum of value × stage probability over open stages. */
  weightedValue: number;
  wonCount: number;
  wonValue: number;
  lostCount: number;
  lostValue: number;
  totalCount: number;
  /** won ÷ (won + lost), 0–1; null until something has closed. */
  winRate: number | null;
};

export type PipelineStatus = "open" | "won" | "lost" | "complete" | "all";

const num = (v: number | string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const clampProbability = (v: number | string) => Math.min(100, Math.max(0, num(v)));

/**
 * The only place pipeline totals are derived. Stats tiles, status counts and column
 * headers all read from this, so they always agree with each other and with the board.
 */
export function derivePipelineTotals(stages: StageAggregate[]): PipelineTotals {
  const out: PipelineTotals = {
    openCount: 0,
    openValue: 0,
    weightedValue: 0,
    wonCount: 0,
    wonValue: 0,
    lostCount: 0,
    lostValue: 0,
    totalCount: 0,
    winRate: null,
  };
  for (const s of stages) {
    const count = Math.max(0, num(s.count));
    const value = num(s.totalValue);
    out.totalCount += count;
    if (s.isWon) {
      out.wonCount += count;
      out.wonValue += value;
    } else if (s.isLost) {
      out.lostCount += count;
      out.lostValue += value;
    } else {
      out.openCount += count;
      out.openValue += value;
      out.weightedValue += (value * clampProbability(s.probability)) / 100;
    }
  }
  const closed = out.wonCount + out.lostCount;
  out.winRate = closed > 0 ? out.wonCount / closed : null;
  return out;
}

/** Lead counts per status segment, from the same totals. */
export function statusCounts(t: PipelineTotals): Record<PipelineStatus, number> {
  return { open: t.openCount, won: t.wonCount, lost: t.lostCount, complete: t.wonCount, all: t.totalCount };
}
