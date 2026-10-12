import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { legacyRedirectFor } from "./legacy-redirects.ts";

describe("legacy sales redirects", () => {
  it("sends customer and deal pages to Leads", () => {
    for (const path of ["/customers", "/customers/abc-123", "/deals", "/deals/xyz", "/deals/"]) {
      assert.equal(legacyRedirectFor(path), "/leads", path);
    }
  });

  it("sends the old deal pipeline page to the lead Pipeline", () => {
    assert.equal(legacyRedirectFor("/pipelines"), "/pipeline");
  });

  it("leaves every other page alone, including Leads and Pipeline", () => {
    for (const path of ["/leads", "/pipeline", "/", "/activities", "/customers/abc/edit", "/admin/pipelines", "/dealsx"]) {
      assert.equal(legacyRedirectFor(path), null, path);
    }
  });
});
