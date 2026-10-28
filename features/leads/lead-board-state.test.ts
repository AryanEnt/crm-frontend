import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LeadBoard, LeadBoardCard, LeadBoardStage } from "@/lib/api/crm";
import {
  EMPTY_LEAD_FILTERS,
  activeFilterCount,
  adjacentStageId,
  appendStagePage,
  applyPendingMoves,
  classifyMove,
  findCard,
  leadFilterParams,
  moveCard,
} from "./lead-board-state.ts";

function card(id: string, stageId: string, over: Partial<LeadBoardCard> = {}): LeadBoardCard {
  return {
    id,
    fullName: `Lead ${id}`,
    employer: "",
    phone: null,
    email: null,
    potentialValue: 100,
    currency: "AUD",
    stageId,
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
    stageEnteredAt: "2026-01-01T00:00:00.000Z",
    wonAt: null,
    lostAt: null,
    lostReason: "",
    ...over,
  };
}

function stage(id: string, leads: LeadBoardCard[], over: Partial<LeadBoardStage> = {}): LeadBoardStage {
  return {
    id,
    name: id,
    position: 0,
    isWon: false,
    isLost: false,
    probability: 10,
    visualAccent: "",
    requiredFields: [],
    requiredActivities: [],
    requiredDocuments: [],
    count: leads.length,
    totalValue: leads.reduce((sum, l) => sum + (l.potentialValue ?? 0), 0),
    hasMore: false,
    leads,
    ...over,
  };
}

function board(): LeadBoard {
  return {
    pipeline: { id: "p", name: "Lead Pipeline", kind: "leads", isDefault: true },
    stages: [
      stage("created", [card("a", "created"), card("b", "created", { potentialValue: null })]),
      stage("proposal", [card("c", "proposal", { potentialValue: 400 })], { probability: 50 }),
      stage("won", [card("w", "won", { status: "won", wonAt: "2026-02-01T00:00:00.000Z" })], {
        isWon: true,
        probability: 100,
      }),
      stage("lost", [], { isLost: true, probability: 0 }),
    ],
  };
}

const NOW = "2026-10-02T00:00:00.000Z";

describe("classifyMove", () => {
  const b = board();
  const [created, proposal, won, lost] = b.stages;

  it("ignores drops on the same column", () => {
    assert.deepEqual(classifyMove(card("a", "created"), created), { kind: "noop" });
  });

  it("moves open leads between open stages", () => {
    assert.deepEqual(classifyMove(card("a", "created"), proposal), { kind: "move" });
  });

  it("asks for a document send deadline before Won", () => {
    assert.deepEqual(classifyMove(card("a", "created"), won), { kind: "won_deadline" });
  });

  it("moves into Nurturing Complete without a document deadline", () => {
    assert.deepEqual(
      classifyMove(card("a", "created"), won, { pipelineId: "55555555-5555-5555-5555-555555555505" }),
      { kind: "move" },
    );
  });

  it("asks for a lost reason before Lost", () => {
    assert.deepEqual(classifyMove(card("a", "created"), lost), { kind: "lost_reason" });
  });

  it("requires a reopen for closed leads, plus a reason when going to Lost", () => {
    const closed = card("w", "won", { status: "won" });
    assert.deepEqual(classifyMove(closed, proposal), { kind: "reopen", lostReason: false });
    assert.deepEqual(classifyMove(closed, lost), { kind: "reopen", lostReason: true });
  });
});

describe("moveCard", () => {
  it("moves the card to the top of the target and keeps counts and totals in step", () => {
    const next = moveCard(board(), "a", "proposal", { now: NOW });
    const [created, proposal] = next.stages;
    assert.deepEqual(created.leads.map((l) => l.id), ["b"]);
    assert.equal(created.count, 1);
    assert.equal(created.totalValue, 0);
    assert.deepEqual(proposal.leads.map((l) => l.id), ["a", "c"]);
    assert.equal(proposal.count, 2);
    assert.equal(proposal.totalValue, 500);
    assert.equal(proposal.leads[0].stageId, "proposal");
    assert.equal(proposal.leads[0].stageEnteredAt, NOW);
  });

  it("sets won/lost status and the lost reason, and clears them on reopen", () => {
    const lost = moveCard(board(), "a", "lost", { now: NOW, lostReason: "Price" });
    const moved = findCard(lost, "a")!.card;
    assert.equal(moved.status, "lost");
    assert.equal(moved.lostAt, NOW);
    assert.equal(moved.lostReason, "Price");

    const reopened = findCard(moveCard(lost, "a", "created", { now: NOW }), "a")!.card;
    assert.equal(reopened.status, "open");
    assert.equal(reopened.lostAt, null);
    assert.equal(reopened.lostReason, "");
  });

  it("counts a lead without a value as zero", () => {
    const next = moveCard(board(), "b", "proposal");
    assert.equal(next.stages[1].totalValue, 400);
  });

  it("returns the same board for unknown leads, unknown stages and no-op moves", () => {
    const b = board();
    assert.equal(moveCard(b, "zzz", "proposal"), b);
    assert.equal(moveCard(b, "a", "zzz"), b);
    assert.equal(moveCard(b, "a", "created"), b);
  });

  it("rolls back by restoring the snapshot taken before the optimistic move", () => {
    const snapshot = board();
    const optimistic = moveCard(snapshot, "a", "won", { now: NOW });
    assert.equal(findCard(optimistic, "a")!.stage.id, "won");
    assert.equal(findCard(snapshot, "a")!.stage.id, "created");
    assert.equal(snapshot.stages[0].count, 2);
  });
});

describe("applyPendingMoves", () => {
  it("keeps an in-flight move when a stale refetch still has the card in its old column", () => {
    const next = applyPendingMoves(board(), { a: "proposal" });
    assert.equal(findCard(next, "a")!.stage.id, "proposal");
    assert.equal(next.stages[0].leads.filter((l) => l.id === "a").length, 0);
  });

  it("is a no-op once the server has caught up", () => {
    const caughtUp = moveCard(board(), "a", "proposal");
    assert.equal(applyPendingMoves(caughtUp, { a: "proposal" }), caughtUp);
  });
});

describe("appendStagePage", () => {
  it("appends the next page without duplicating cards and updates hasMore", () => {
    const b = board();
    b.stages[0].hasMore = true;
    const next = appendStagePage(b, "created", { leads: [card("b", "created"), card("d", "created")], hasMore: false });
    assert.deepEqual(next.stages[0].leads.map((l) => l.id), ["a", "b", "d"]);
    assert.equal(next.stages[0].hasMore, false);
  });
});

describe("board helpers", () => {
  it("finds neighbouring columns for keyboard moves", () => {
    const b = board();
    assert.equal(adjacentStageId(b, "created", 1), "proposal");
    assert.equal(adjacentStageId(b, "created", -1), null);
    assert.equal(adjacentStageId(b, "lost", 1), null);
  });
});

describe("leadFilterParams", () => {
  it("only sends filters that are set, trimming search and tag", () => {
    const p = leadFilterParams("pipe-1", {
      ...EMPTY_LEAD_FILTERS,
      search: "  jane ",
      priority: "high",
      activity: "overdue",
      tag: " vip ",
    });
    assert.equal(p.toString(), "pipelineId=pipe-1&q=jane&priority=high&activity=overdue&tag=vip");
    assert.equal(leadFilterParams("", EMPTY_LEAD_FILTERS).toString(), "");
  });

  it("counts active filters", () => {
    assert.equal(activeFilterCount(EMPTY_LEAD_FILTERS), 0);
    assert.equal(activeFilterCount({ ...EMPTY_LEAD_FILTERS, source: "Web", tag: "vip" }), 2);
  });
});
