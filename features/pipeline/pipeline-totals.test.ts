import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { derivePipelineTotals, statusCounts, type StageAggregate } from "./pipeline-totals.ts";

const stage = (over: Partial<StageAggregate>): StageAggregate => ({
  isWon: false,
  isLost: false,
  count: 0,
  totalValue: 0,
  probability: 0,
  ...over,
});

const STAGES: StageAggregate[] = [
  stage({ count: 4, totalValue: 10_000, probability: 10 }),
  stage({ count: 2, totalValue: 5_000, probability: 40 }),
  stage({ count: 1, totalValue: 20_000, probability: 80 }),
  stage({ isWon: true, count: 3, totalValue: 9_000, probability: 100 }),
  stage({ isLost: true, count: 1, totalValue: 2_000, probability: 0 }),
];

describe("derivePipelineTotals", () => {
  it("sums open leads and value, and weights each open stage by its probability", () => {
    const t = derivePipelineTotals(STAGES);
    assert.equal(t.openCount, 7);
    assert.equal(t.openValue, 35_000);
    // 10,000 × 10% + 5,000 × 40% + 20,000 × 80%
    assert.equal(t.weightedValue, 1_000 + 2_000 + 16_000);
  });

  it("keeps won and lost out of the open totals and computes win rate as won ÷ (won + lost)", () => {
    const t = derivePipelineTotals(STAGES);
    assert.equal(t.wonCount, 3);
    assert.equal(t.wonValue, 9_000);
    assert.equal(t.lostCount, 1);
    assert.equal(t.lostValue, 2_000);
    assert.equal(t.totalCount, 11);
    assert.equal(t.winRate, 0.75);
  });

  it("has no win rate until something closes", () => {
    const t = derivePipelineTotals([stage({ count: 2, totalValue: 100, probability: 20 })]);
    assert.equal(t.winRate, null);
    assert.equal(t.weightedValue, 20);
  });

  it("accepts numeric strings from the API and ignores junk", () => {
    const t = derivePipelineTotals([
      stage({ count: 1, totalValue: "1500.50", probability: "60.00" }),
      stage({ count: 1, totalValue: "n/a", probability: "x" }),
    ]);
    assert.equal(t.openValue, 1500.5);
    assert.equal(t.weightedValue, 900.3);
  });

  it("clamps probability to 0–100", () => {
    const t = derivePipelineTotals([stage({ count: 1, totalValue: 100, probability: 250 })]);
    assert.equal(t.weightedValue, 100);
  });

  it("is all zeros for an empty board", () => {
    const t = derivePipelineTotals([]);
    assert.deepEqual(statusCounts(t), { open: 0, won: 0, lost: 0, complete: 0, all: 0 });
    assert.equal(t.openValue, 0);
  });

  it("gives status counts that add up to the whole board", () => {
    const counts = statusCounts(derivePipelineTotals(STAGES));
    assert.deepEqual(counts, { open: 7, won: 3, lost: 1, complete: 3, all: 11 });
    assert.equal(counts.open + counts.won + counts.lost, counts.all);
  });
});
