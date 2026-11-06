import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isClientsStage, isFileDeliveredStage } from "./nurturing-stages.ts";

describe("nurturing stage helpers", () => {
  it("recognises Clients", () => {
    assert.equal(isClientsStage("Clients"), true);
    assert.equal(isClientsStage("clients"), true);
    assert.equal(isClientsStage("File Delivered"), false);
  });

  it("recognises File Delivered (and legacy Documents Sent)", () => {
    assert.equal(isFileDeliveredStage("File Delivered"), true);
    assert.equal(isFileDeliveredStage("Documents Sent"), true);
    assert.equal(isFileDeliveredStage("Clients"), false);
  });
});
