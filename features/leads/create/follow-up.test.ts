import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  atDefaultHour,
  formatFollowUp,
  isoToZonedInput,
  matchPreset,
  nowInZone,
  resolveFollowUp,
  toLocalInput,
  withTime,
  zonedInputToIso,
} from "./follow-up.ts";

// Friday 2 October 2026, 14:37 local time.
const now = new Date(2026, 9, 2, 14, 37);

describe("follow-up shortcuts", () => {
  it("resolves tomorrow and in 3 days at 9:00", () => {
    assert.equal(toLocalInput(resolveFollowUp("tomorrow", now)), "2026-10-03T09:00");
    assert.equal(toLocalInput(resolveFollowUp("in3days", now)), "2026-10-05T09:00");
  });

  it("resolves next week to the following Monday", () => {
    assert.equal(toLocalInput(resolveFollowUp("nextweek", now)), "2026-10-05T09:00");
    const monday = new Date(2026, 9, 5, 8, 0);
    assert.equal(toLocalInput(resolveFollowUp("nextweek", monday)), "2026-10-12T09:00");
    const sunday = new Date(2026, 9, 4, 20, 0);
    assert.equal(toLocalInput(resolveFollowUp("nextweek", sunday)), "2026-10-05T09:00");
  });

  it("crosses month ends", () => {
    assert.equal(toLocalInput(resolveFollowUp("in3days", new Date(2026, 9, 30, 10))), "2026-11-02T09:00");
  });

  it("formats the resolved date the way it is read aloud", () => {
    assert.equal(formatFollowUp(new Date(2026, 9, 7, 9, 0)), "Wed 7 Oct, 9:00");
    assert.equal(formatFollowUp(new Date(2026, 9, 6, 14, 5)), "Tue 6 Oct, 14:05");
  });

  it("recognises which shortcut produced a value", () => {
    assert.equal(matchPreset("2026-10-03T09:00", now), "tomorrow");
    assert.equal(matchPreset("2026-10-03T10:00", now), null);
    assert.equal(matchPreset("", now), null);
  });

  it("keeps the day when the time changes, and picks 9:00 for a calendar day", () => {
    assert.equal(withTime("2026-10-07T09:00", "16:30"), "2026-10-07T16:30");
    assert.equal(withTime("2026-10-07T09:00", "nope"), "2026-10-07T09:00");
    assert.equal(atDefaultHour(new Date(2026, 9, 20, 23, 59)), "2026-10-20T09:00");
  });
});

describe("follow-ups in the user's time zone", () => {
  it("reads 9:00 as 9:00 where the user is, across daylight saving", () => {
    // Sydney is UTC+10 before the first Sunday of October 2026 and UTC+11 after it.
    assert.equal(zonedInputToIso("2026-10-03T09:00", "Australia/Sydney"), "2026-10-02T23:00:00.000Z");
    assert.equal(zonedInputToIso("2026-10-05T09:00", "Australia/Sydney"), "2026-10-04T22:00:00.000Z");
    assert.equal(zonedInputToIso("2026-10-05T09:00", "Asia/Kathmandu"), "2026-10-05T03:15:00.000Z");
  });

  it("works out today in the user's zone", () => {
    const instant = new Date("2026-10-02T20:00:00Z");
    assert.equal(toLocalInput(nowInZone("Australia/Sydney", instant)), "2026-10-03T06:00");
    assert.equal(toLocalInput(resolveFollowUp("tomorrow", nowInZone("Australia/Sydney", instant))), "2026-10-04T09:00");
  });

  it("falls back to the browser zone for unknown zones", () => {
    const instant = new Date(2026, 9, 2, 14, 37);
    assert.equal(nowInZone("Not/AZone", instant), instant);
    assert.equal(zonedInputToIso("2026-10-03T09:00", undefined), new Date(2026, 9, 3, 9, 0).toISOString());
    assert.equal(zonedInputToIso("nope", "Australia/Sydney"), null);
  });

  it("shows a saved follow-up at the same wall-clock time it was set for", () => {
    assert.equal(isoToZonedInput("2026-10-04T22:00:00.000Z", "Australia/Sydney"), "2026-10-05T09:00");
    assert.equal(isoToZonedInput(zonedInputToIso("2026-10-03T09:00", "Asia/Kathmandu"), "Asia/Kathmandu"), "2026-10-03T09:00");
    assert.equal(isoToZonedInput(null, "Australia/Sydney"), "");
    assert.equal(isoToZonedInput("nope", "Australia/Sydney"), "");
  });
});
