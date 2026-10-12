import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { previewKind } from "./preview-kind.ts";

describe("document preview kind", () => {
  it("previews PDFs, images, text and media by their type", () => {
    assert.equal(previewKind({ mimeType: "application/pdf", name: "visa" }), "pdf");
    assert.equal(previewKind({ mimeType: "image/jpeg", name: "x" }), "image");
    assert.equal(previewKind({ mimeType: "text/csv; charset=utf-8", name: "x" }), "text");
    assert.equal(previewKind({ mimeType: "audio/mpeg", name: "call" }), "audio");
  });

  it("uses the extension only when the type is missing", () => {
    assert.equal(previewKind({ mimeType: "", name: "Passport.PDF" }), "pdf");
    assert.equal(previewKind({ mimeType: "application/octet-stream", name: "scan.png" }), "image");
    assert.equal(previewKind({ mimeType: "application/vnd.ms-excel", name: "sheet.csv" }), "none");
  });

  it("has no preview for Office files, HTML or SVG", () => {
    assert.equal(previewKind({ mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", name: "cv.docx" }), "none");
    assert.equal(previewKind({ mimeType: "text/html", name: "page.html" }), "none");
    assert.equal(previewKind({ mimeType: "image/svg+xml", name: "logo.svg" }), "none");
  });
});
