import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACTIVITY_TITLE_MAX_WORDS,
  activityTitleWithinLimit,
  activityTitleWordCount,
} from "./activity-title.ts";

describe("activity title word limit", () => {
  it(`counts words and allows blank or up to ${ACTIVITY_TITLE_MAX_WORDS}`, () => {
    assert.equal(activityTitleWordCount(""), 0);
    assert.equal(activityTitleWordCount("  Follow-up call  "), 2);
    assert.equal(activityTitleWordCount("Call Priya back"), 3);
    assert.equal(activityTitleWordCount("Call Priya back tomorrow"), 4);
    assert.equal(activityTitleWithinLimit(""), true);
    assert.equal(activityTitleWithinLimit("Call Priya back"), true);
    assert.equal(activityTitleWithinLimit("Call Priya back tomorrow"), false);
  });
});
