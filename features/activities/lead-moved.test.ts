import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bulkLeadMovedMessage, leadMovedMessage } from "./lead-moved.ts";

const contacted = { stageId: "s-contacted", stageName: "Contacted" };

describe("leadMovedMessage", () => {
  it("names the lead and its new stage", () => {
    assert.equal(leadMovedMessage({ leadName: "Ram", leadMovedTo: contacted }), "Ram moved to Contacted");
    assert.equal(leadMovedMessage({ leadName: null, leadMovedTo: contacted }), "Lead moved to Contacted");
  });

  it("is empty when the lead did not move", () => {
    assert.equal(leadMovedMessage({ leadName: "Ram" }), undefined);
    assert.equal(leadMovedMessage(undefined), undefined);
  });
});

describe("bulkLeadMovedMessage", () => {
  it("summarises several moves", () => {
    assert.equal(bulkLeadMovedMessage([{ leadName: "Ram" }]), undefined);
    assert.equal(bulkLeadMovedMessage([{ leadName: "Ram", leadMovedTo: contacted }, { leadName: "Sita" }]), "Ram moved to Contacted");
    assert.equal(
      bulkLeadMovedMessage([
        { leadName: "Ram", leadMovedTo: contacted },
        { leadName: "Sita", leadMovedTo: contacted },
      ]),
      "2 leads moved to Contacted",
    );
    assert.equal(
      bulkLeadMovedMessage([
        { leadName: "Ram", leadMovedTo: contacted },
        { leadName: "Sita", leadMovedTo: { stageId: "s-q", stageName: "Qualified" } },
      ]),
      "2 leads moved forward",
    );
  });
});
