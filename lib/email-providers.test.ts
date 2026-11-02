import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emailDomain } from "./email-providers.ts";

describe("emailDomain", () => {
  it("returns the lowercased domain of a full address", () => {
    assert.equal(emailDomain(" Priya@Sales.Example.COM "), "sales.example.com");
  });

  it("waits until the domain looks complete", () => {
    for (const partial of ["", "priya", "priya@", "priya@example", "@example.com", "priya@example."]) {
      assert.equal(emailDomain(partial), "", partial);
    }
  });
});
