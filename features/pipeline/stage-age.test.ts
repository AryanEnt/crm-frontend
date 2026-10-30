import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stageAge } from "./stage-age.ts";

describe("stageAge", () => {
  const entered = "2026-10-24T00:00:00.000Z";
  const now = Date.parse("2026-10-29T00:00:00.000Z"); // 5 days later

  it("stays neutral without an SLA or when closed", () => {
    assert.equal(stageAge(entered, null, { now }).tone, "none");
    assert.equal(stageAge(entered, 120, { closed: true, now }).tone, "none");
  });

  it("is ok under 80% of SLA", () => {
    // 5 days in a 10-day SLA (120h of 240h = 50%)
    assert.deepEqual(stageAge(entered, 240, { now }), {
      tone: "ok",
      days: 5,
      fillPercent: 50,
    });
  });

  it("warns past 80% and turns over past 100%", () => {
    // 5 days in a ~5.5 day SLA (~90%)
    assert.equal(stageAge(entered, 132, { now }).tone, "warn");
    // 5 days in a 5-day SLA (exactly at / over)
    assert.equal(stageAge(entered, 120, { now }).tone, "over");
    assert.equal(stageAge(entered, 100, { now }).tone, "over");
  });
});
