import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  contactRatingLabel,
  contactRemarksProblem,
  isContactRatingBlocker,
  isContactedStage,
  validContactRemarks,
} from "./contact-rating.ts";

describe("contact rating helpers", () => {
  it("recognises Contacted", () => {
    assert.equal(isContactedStage("Contacted"), true);
    assert.equal(isContactedStage("Leads"), false);
  });

  it("requires five unique words", () => {
    assert.equal(validContactRemarks("word word word word word"), false);
    assert.equal(validContactRemarks("spoke about budget timeline and next steps"), true);
    assert.match(contactRemarksProblem("a a a a a") ?? "", /different words/);
  });

  it("builds a compact label", () => {
    assert.equal(contactRatingLabel(null, ""), "");
    assert.equal(contactRatingLabel(3, "ok so far"), "★★★☆☆ · ok so far");
  });

  it("detects contact-rating stage blockers", () => {
    assert.equal(isContactRatingBlocker({ reason: "contact_rating_required" }), true);
    assert.equal(
      isContactRatingBlocker({ missingFields: ["contact_rating", "contact_remarks"] }),
      true,
    );
    assert.equal(isContactRatingBlocker({ missingFields: ["email"] }), false);
    assert.equal(
      isContactRatingBlocker({
        missingFields: ["contact_rating"],
        missingActivities: ["call"],
      }),
      false,
    );
  });
});
