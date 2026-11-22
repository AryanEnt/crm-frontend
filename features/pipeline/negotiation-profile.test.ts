import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isNegotiationProfileBlocker,
  negotiationProfileMissing,
} from "./negotiation-profile.ts";

describe("negotiation profile helpers", () => {
  it("detects negotiation-profile stage blockers", () => {
    assert.equal(isNegotiationProfileBlocker({ reason: "negotiation_profile_required" }), true);
    assert.equal(
      isNegotiationProfileBlocker({ missingFields: ["country", "nationality", "phone"] }),
      true,
    );
    assert.equal(isNegotiationProfileBlocker({ missingFields: ["email"] }), false);
    assert.equal(
      isNegotiationProfileBlocker({
        missingFields: ["country"],
        missingActivities: ["call"],
      }),
      false,
    );
  });

  it("returns unique missing field keys, or all three when none are listed", () => {
    assert.deepEqual(negotiationProfileMissing({ missingFields: ["Nationality", "phone"] }), [
      "nationality",
      "phone",
    ]);
    assert.deepEqual(negotiationProfileMissing({ missingFields: [] }), [
      "country",
      "nationality",
      "phone",
    ]);
  });
});
