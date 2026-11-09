import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isPipelineLeadDoc, showsAddDocumentSection } from "./pipeline-lead-documents.ts";

describe("pipeline lead documents", () => {
  it("shows Add Document on Negotiation, Purchased and Lost", () => {
    assert.equal(showsAddDocumentSection("Negotiation"), true);
    assert.equal(showsAddDocumentSection("Purchased"), true);
    assert.equal(showsAddDocumentSection("Lost"), true);
    assert.equal(showsAddDocumentSection("Contacted"), false);
    assert.equal(showsAddDocumentSection("Leads"), false);
  });

  it("keeps closed sales cards and hides nurturing-only stages", () => {
    assert.equal(showsAddDocumentSection("Purchased", "won"), true);
    assert.equal(showsAddDocumentSection(null, "lost"), true);
    assert.equal(showsAddDocumentSection("Outcome", "won"), false);
    assert.equal(showsAddDocumentSection("File Delivered"), false);
    assert.equal(showsAddDocumentSection("Clients"), false);
  });

  it("recognises pipeline lead document types", () => {
    assert.equal(isPipelineLeadDoc({ type: "lead_document", category: "pipeline" }), true);
    assert.equal(isPipelineLeadDoc({ type: "screenshot", category: "screenshot" }), false);
    assert.equal(isPipelineLeadDoc({ type: "outcome_letter", category: "outcome_letter" }), false);
  });
});
