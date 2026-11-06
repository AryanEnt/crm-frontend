import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatStageAgeLabel, stageAge } from "./stage-age.ts";

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
      hours: 120,
      hoursPart: 0,
      fillPercent: 50,
    });
  });

  it("warns past 80% and turns rotten at 100%", () => {
    // 5 days in a ~5.5 day SLA (~90%)
    assert.equal(stageAge(entered, 132, { now }).tone, "warn");
    // 5 days in a 5-day SLA (exactly at / over) → Rotten
    assert.equal(stageAge(entered, 120, { now }).tone, "over");
    assert.equal(stageAge(entered, 100, { now }).tone, "over");
  });

  it("tracks hours within a day for Leads (24h) and Contacted (48h) limits", () => {
    const start = "2026-11-05T08:00:00.000Z";
    const after26h = Date.parse("2026-11-06T10:00:00.000Z");
    const age = stageAge(start, 24, { now: after26h });
    assert.equal(age.tone, "over");
    assert.equal(age.days, 1);
    assert.equal(age.hours, 26);
    assert.equal(age.hoursPart, 2);
  });
});

describe("formatStageAgeLabel", () => {
  it("always shows hours, including under one day", () => {
    assert.equal(formatStageAgeLabel({ days: 0, hours: 0, hoursPart: 0 }), "0 Hours");
    assert.equal(formatStageAgeLabel({ days: 0, hours: 5, hoursPart: 5 }), "5 Hours");
    assert.equal(formatStageAgeLabel({ days: 0, hours: 1, hoursPart: 1 }), "1 Hour");
  });

  it("formats day + hour pairs like the rotting requirement", () => {
    assert.equal(formatStageAgeLabel({ days: 1, hours: 26, hoursPart: 2 }), "1 Day 2 Hours");
    assert.equal(formatStageAgeLabel({ days: 2, hours: 53, hoursPart: 5 }), "2 Days 5 Hours");
    assert.equal(formatStageAgeLabel({ days: 4, hours: 108, hoursPart: 12 }), "4 Days 12 Hours");
    assert.equal(formatStageAgeLabel({ days: 1, hours: 25, hoursPart: 1 }), "1 Day 1 Hour");
  });
});
