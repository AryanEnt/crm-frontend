import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { statusTone, typeDotClass } from "./calendar-colors.ts";

describe("typeDotClass", () => {
  it("gives meeting (violet) its own colour instead of sharing email's brand teal", () => {
    assert.equal(typeDotClass("meeting", "violet"), "bg-orchid");
    assert.equal(typeDotClass("email", "teal"), "bg-brand");
  });

  it("draws SMS as an outline so it stays distinct from email", () => {
    const sms = typeDotClass("sms", "teal");
    assert.match(sms, /border-brand/);
    assert.doesNotMatch(sms, /\bbg-/);
  });

  it("falls back to slate for unknown colours", () => {
    assert.equal(typeDotClass("call", "mauve"), "bg-foreground-muted");
  });
});

describe("statusTone", () => {
  it("keeps overdue off amber, which follow-ups use", () => {
    assert.equal(statusTone("overdue"), "danger");
    assert.equal(statusTone("completed"), "success");
  });
});
