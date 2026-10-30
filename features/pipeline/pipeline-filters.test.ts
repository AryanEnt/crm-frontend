import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PIPELINE_FILTERS,
  activeFilterChips,
  boardParams,
  clearAllFilters,
  clearFilter,
  closedLeadsParams,
  closedListParams,
  hasNarrowingFilters,
  parsePipelineFilters,
  writePipelineFilters,
} from "./pipeline-filters.ts";

const parse = (qs: string) => parsePipelineFilters(new URLSearchParams(qs));

describe("pipeline filters in the URL", () => {
  it("defaults to every lead, Won and Lost included, with no narrowing", () => {
    assert.equal(DEFAULT_PIPELINE_FILTERS.status, "all");
    assert.deepEqual(parse(""), DEFAULT_PIPELINE_FILTERS);
    assert.equal(writePipelineFilters(DEFAULT_PIPELINE_FILTERS).toString(), "");
  });

  it("round-trips every filter and keeps unrelated params such as leadId", () => {
    const qs = "status=won&q=acme&next=week&owner=u1&team=t1&source=Web&min=1000&max=5000&sort=value&order=asc&page=3";
    const f = parse(qs);
    const out = writePipelineFilters(f, new URLSearchParams("leadId=abc"));
    assert.equal(out.get("leadId"), "abc");
    assert.deepEqual(parsePipelineFilters(out), f);
  });

  it("ignores invalid values instead of sending them to the API", () => {
    const f = parse("status=archived&next=soon&min=-5&max=abc&page=0&sort=owner");
    assert.equal(f.status, "all");
    assert.equal(f.next, "");
    assert.equal(f.min, "");
    assert.equal(f.max, "");
    assert.equal(f.page, 1);
    assert.equal(f.sort, "closed");
  });

  it("round-trips the closed date filter and view", () => {
    const f = parse("status=lost&closed=custom&closedFrom=2026-10-05&closedTo=2026-09-01&view=table");
    assert.equal(f.closedFrom, "2026-09-01");
    assert.equal(f.closedTo, "2026-10-05");
    assert.equal(f.view, "table");
    assert.deepEqual(parsePipelineFilters(writePipelineFilters(f)), f);
    assert.equal(parse("closed=custom&closedFrom=nope").closed, "");
    assert.equal(parse("closed=30d&closedFrom=2026-09-01").closedFrom, "");
  });

  it("swaps a reversed value range and strips currency formatting", () => {
    const f = parse("min=%245%2C000&max=1000");
    assert.equal(f.min, "1000");
    assert.equal(f.max, "5000");
  });
});

describe("API params", () => {
  const f = parse("status=lost&q=%20jo%20&next=overdue&owner=u1&team=t1&source=Referral&min=100&page=2&sort=name&order=asc");

  it("board and closed views share the same narrowing filters, minus next action", () => {
    const board = boardParams("p1", f);
    assert.equal(board.toString(), "pipelineId=p1&q=jo&ownerUserId=u1&teamId=t1&source=Referral&activity=overdue&minValue=100");
    const closed = closedListParams("p1", "lost-stage", f, 25);
    for (const [k, v] of board) if (k !== "activity") assert.equal(closed.get(k), v, k);
    assert.equal(closed.has("activity"), false);
  });

  it("sends country on the board and closed list params", () => {
    const withCountry = parse("country=Australia&q=jo");
    assert.equal(boardParams("p1", withCountry).get("country"), "Australia");
    assert.equal(closedListParams("p1", "lost-stage", withCountry, 25).get("country"), "Australia");
    assert.equal(writePipelineFilters(withCountry).get("country"), "Australia");
  });

  it("narrows closed leads to the date range, and each kanban column to its own", () => {
    const from = Date.UTC(2026, 8, 1);
    const to = Date.UTC(2026, 9, 1);
    const closed = closedLeadsParams("p1", "won-stage", f, { from, to }, 25, 50);
    assert.equal(closed.get("closedFrom"), "2026-09-01T00:00:00.000Z");
    assert.equal(closed.get("closedTo"), "2026-10-01T00:00:00.000Z");
    assert.equal(closed.get("offset"), "50");
    assert.equal(closedListParams("p1", "won-stage", f, 25).has("closedFrom"), false);
  });

  it("closed tables select the outcome stage, any status, with sorting and paging", () => {
    const closed = closedListParams("p1", "lost-stage", f, 25);
    assert.equal(closed.get("stageId"), "lost-stage");
    assert.equal(closed.get("status"), "all");
    assert.equal(closed.get("sort"), "name");
    assert.equal(closed.get("order"), "asc");
    assert.equal(closed.get("limit"), "25");
    assert.equal(closed.get("offset"), "25");
  });

  it("Won lists by won_at, not the sales Won stage (leads hand off to Nurturing)", () => {
    const won = closedListParams("p1", "won-stage", parse("status=won&sort=closed&order=desc"), 25, undefined, "won");
    assert.equal(won.get("status"), "won");
    assert.equal(won.has("stageId"), false);
    assert.equal(won.has("pipelineId"), false);
    assert.equal(won.get("sort"), "closed");
    assert.equal(won.get("limit"), "25");
  });

  it("Complete lists the Complete stage on this pipeline, not won_at", () => {
    const complete = closedListParams(
      "p1",
      "complete-stage",
      parse("status=complete&sort=closed&order=desc"),
      25,
      undefined,
      "complete",
    );
    assert.equal(complete.get("stageId"), "complete-stage");
    assert.equal(complete.get("pipelineId"), "p1");
    assert.equal(complete.get("status"), "all");
  });
});

describe("filter chips", () => {
  it("lists active filters with readable labels", () => {
    const f = parse("next=week&owner=u1&team=t1&source=Web&min=1000&max=5000");
    assert.deepEqual(
      activeFilterChips(f, { owner: "Asha Rai", team: "Sydney" }).map((c) => c.label),
      ["Next action: this week", "Team: Sydney", "Individual: Asha Rai", "Source: Web", "Value: $1,000–$5,000"],
    );
    assert.deepEqual(activeFilterChips(parse("min=500")).map((c) => c.label), ["Value: $500+"]);
    assert.deepEqual(activeFilterChips(parse("max=500")).map((c) => c.label), ["Value: Up to $500"]);
  });

  it("removing a chip clears just that filter and returns to page one", () => {
    const f = parse("status=won&source=Web&min=1&max=9&page=4");
    const noValue = clearFilter(f, "value");
    assert.equal(noValue.min, "");
    assert.equal(noValue.max, "");
    assert.equal(noValue.source, "Web");
    assert.equal(noValue.page, 1);
  });

  it("clear all keeps the status view but drops every narrowing filter", () => {
    const f = clearAllFilters(parse("status=won&q=x&next=today&owner=u&team=t1&source=s&min=1&closed=7d&view=table"));
    assert.equal(f.status, "won");
    assert.equal(f.view, "table");
    assert.equal(f.closed, "");
    assert.equal(hasNarrowingFilters(f), false);
  });

  it("shows the date filter on Won and Lost, where next action doesn't apply", () => {
    const won = parse("status=won&closed=30d&next=week");
    assert.deepEqual(activeFilterChips(won).map((c) => c.label), ["Won past 30 days"]);
    assert.equal(hasNarrowingFilters(parse("status=won&next=week")), false);
    assert.equal(hasNarrowingFilters(parse("status=open&closed=30d")), false);
    const custom = parse("status=lost&closed=custom&closedFrom=2026-09-01&closedTo=2026-09-30");
    assert.deepEqual(activeFilterChips(custom).map((c) => c.label), ["Lost 1 Sept 2026 – 30 Sept 2026"]);
    assert.equal(clearFilter(custom, "closed").closedFrom, "");
  });
});
