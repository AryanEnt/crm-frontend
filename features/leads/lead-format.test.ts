import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatStageDuration } from "./lead-format.ts";

describe("formatStageDuration", () => {
  it("formats minutes, hours and days the way Lead History shows them", () => {
    assert.equal(formatStageDuration(35 * 60), "35 minutes");
    assert.equal(formatStageDuration(4 * 3600 + 20 * 60), "4 hours, 20 minutes");
    assert.equal(formatStageDuration(1 * 86400 + 5 * 3600), "1 day, 5 hours");
    assert.equal(formatStageDuration(2 * 86400 + 3 * 3600 + 15 * 60), "2 days, 3 hours, 15 minutes");
    assert.equal(formatStageDuration(45), "Less than a minute");
  });
});
