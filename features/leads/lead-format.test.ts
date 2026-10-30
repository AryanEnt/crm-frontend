import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countryFilterLabel,
  formatLeadCount,
  formatLeadCountry,
  formatNextAction,
  nextActionTone,
} from "./lead-format.ts";

describe("lead country display", () => {
  it("normalises known names and falls back for blanks", () => {
    assert.equal(formatLeadCountry("australia"), "Australia");
    assert.equal(formatLeadCountry("Nepal"), "Nepal");
    assert.equal(formatLeadCountry(""), "—");
    assert.equal(formatLeadCountry("(Unknown)"), "—");
    assert.equal(formatLeadCountry("  Fiji "), "Fiji");
  });

  it("labels the filter and formats totals", () => {
    assert.equal(countryFilterLabel(""), "All Countries");
    assert.equal(countryFilterLabel("(Unknown)"), "Unknown");
    assert.equal(countryFilterLabel("india"), "India");
    assert.equal(formatLeadCount(1250), "1,250 leads");
    assert.equal(formatLeadCount(1), "1 lead");
    assert.equal(formatLeadCount(0), "0 leads");
  });
});

describe("lead next-action time formatting", () => {
  const now = new Date("2026-10-12T00:00:00.000Z");
  const kathmanduMeeting = "2026-10-12T06:30:00.000Z";

  it("shows the meeting in the user's timezone, not the browser timezone", () => {
    assert.match(formatNextAction(kathmanduMeeting, "Asia/Kathmandu", now), /Today .*12:15/);
    assert.equal(nextActionTone(kathmanduMeeting, "Asia/Kathmandu", now), "today");
    assert.match(formatNextAction(kathmanduMeeting, "UTC", now), /Today .*6:30/);
  });

  it("determines today versus upcoming using the user's calendar day", () => {
    assert.equal(nextActionTone("2026-10-12T18:30:00.000Z", "Asia/Kathmandu", now), "upcoming");
  });
});
