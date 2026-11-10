import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COUNTRY_OPTIONS,
  NATIONALITY_OPTIONS,
  countryCodeFromName,
  countryName,
  nationalityName,
} from "./world.ts";

describe("world geo lists", () => {
  it("covers the full ISO country set with priority markets first", () => {
    assert.ok(COUNTRY_OPTIONS.length > 200);
    assert.equal(COUNTRY_OPTIONS[0]?.value, "Australia");
    assert.ok(COUNTRY_OPTIONS.some((c) => c.value === "France"));
    assert.ok(COUNTRY_OPTIONS.some((c) => c.value === "Brazil"));
    assert.equal(countryName("US"), "United States");
    assert.equal(countryName("GB"), "United Kingdom");
    assert.equal(countryCodeFromName("Nepal"), "NP");
  });

  it("covers nationalities and keeps product demonyms", () => {
    assert.ok(NATIONALITY_OPTIONS.length > 200);
    assert.equal(nationalityName("NP"), "Nepali");
    assert.equal(nationalityName("NZ"), "New Zealander");
    assert.equal(nationalityName("AE"), "Emirati");
    assert.ok(NATIONALITY_OPTIONS.some((n) => n.value === "French"));
    assert.ok(NATIONALITY_OPTIONS.some((n) => n.value === "Nepali"));
  });
});
