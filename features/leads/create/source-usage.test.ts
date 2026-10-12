import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickDefaultSource, rankSources, recordSourceUse } from "./source-usage.ts";

const sources = [
  { name: "Website", usageCount: 40, position: 1 },
  { name: "Referral", usageCount: 10, position: 2 },
  { name: "Event", usageCount: 0, position: 3 },
  { name: "Other", usageCount: 0, position: 4 },
];

describe("lead source ranking", () => {
  it("puts the user's own picks first, then org usage, then admin order", () => {
    assert.deepEqual(rankSources(sources, { counts: {} }), ["Website", "Referral", "Event", "Other"]);
    assert.deepEqual(rankSources(sources, { counts: { Event: 3 } }), ["Event", "Website", "Referral", "Other"]);
  });

  it("remembers the last source and counts uses", () => {
    const u = recordSourceUse(recordSourceUse({ counts: {} }, "Event"), "Event");
    assert.deepEqual(u, { last: "Event", counts: { Event: 2 } });
  });

  it("defaults to last used, then the org default, then Other", () => {
    const ranked = rankSources(sources, { counts: {} });
    assert.equal(pickDefaultSource(ranked, { last: "Referral", counts: {} }, "Website"), "Referral");
    assert.equal(pickDefaultSource(ranked, { last: "Deleted source", counts: {} }, "Website"), "Website");
    assert.equal(pickDefaultSource(ranked, { counts: {} }), "Other");
    assert.equal(pickDefaultSource(["Website"], { counts: {} }), "Website");
    assert.equal(pickDefaultSource([], { counts: {} }), "");
  });
});
