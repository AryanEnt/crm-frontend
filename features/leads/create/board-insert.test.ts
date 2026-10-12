import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LeadBoard, LeadBoardCard, LeadBoardStage } from "../../../lib/api/crm.ts";
import { insertLeadCard, isUnfilteredBoardKey, replaceLeadCard } from "./board-insert.ts";

const card = (over: Partial<LeadBoardCard>): LeadBoardCard => ({
  id: "c",
  fullName: "Lead",
  employer: "",
  phone: null,
  email: null,
  potentialValue: null,
  currency: "AUD",
  stageId: "s1",
  status: "open",
  ownerUserId: null,
  ownerName: null,
  priority: "medium",
  tags: [],
  lastActivityAt: null,
  nextActivityAt: null,
  nextActivityTitle: null,
  nextActivityType: null,
  expectedCloseAt: null,
  stageEnteredAt: "2026-10-02T00:00:00Z",
  wonAt: null,
  lostAt: null,
  lostReason: "",
  ...over,
});

const stage = (id: string, leads: LeadBoardCard[]): LeadBoardStage => ({
  id,
  name: id,
  position: 0,
  isWon: false,
  isLost: false,
  probability: 0,
  visualAccent: "",
  requiredFields: [],
  requiredActivities: [],
  requiredDocuments: [],
  count: leads.length,
  totalValue: leads.reduce((n, l) => n + (l.potentialValue ?? 0), 0),
  hasMore: false,
  leads,
});

const board: LeadBoard = {
  pipeline: { id: "p1", name: "Lead Pipeline", kind: "leads", isDefault: true },
  stages: [stage("s1", [card({ id: "a", potentialValue: 1000 })]), stage("s2", [])],
};

describe("optimistic board insert", () => {
  it("adds the card to the top of its stage with updated totals", () => {
    const next = insertLeadCard(board, card({ id: "tmp", potentialValue: 2500 }));
    assert.ok(next);
    assert.deepEqual(next.stages[0]!.leads.map((l) => l.id), ["tmp", "a"]);
    assert.equal(next.stages[0]!.count, 2);
    assert.equal(next.stages[0]!.totalValue, 3500);
    assert.equal(next.stages[1], board.stages[1]);
  });

  it("skips boards that don't have the stage", () => {
    assert.equal(insertLeadCard(board, card({ stageId: "elsewhere" })), null);
  });

  it("swaps the placeholder for the saved card", () => {
    const withTmp = insertLeadCard(board, card({ id: "tmp" }))!;
    const saved = replaceLeadCard(withTmp, "tmp", card({ id: "lead-42" }));
    assert.deepEqual(saved.stages[0]!.leads.map((l) => l.id), ["lead-42", "a"]);
  });

  it("only touches unfiltered boards of the same pipeline", () => {
    assert.equal(isUnfilteredBoardKey(["lead-board", "p1", "pipelineId=p1"], "p1"), true);
    assert.equal(isUnfilteredBoardKey(["lead-board", "p1", "pipelineId=p1&q=priya"], "p1"), false);
    assert.equal(isUnfilteredBoardKey(["lead-board", "p2", "pipelineId=p2"], "p1"), false);
    assert.equal(isUnfilteredBoardKey(["leads", "p1", ""], "p1"), false);
  });
});
