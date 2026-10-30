import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  countryFromLocale,
  detectDialCountry,
  formatPhone,
  phoneLengthIssue,
  phoneVariants,
  toE164,
} from "./phone.ts";

describe("phone input", () => {
  it("formats national numbers as they are typed", () => {
    assert.equal(formatPhone("0412", "AU"), "0412");
    assert.equal(formatPhone("0412345678", "AU"), "0412 345 678");
    assert.equal(formatPhone("412345678", "AU"), "412 345 678");
    assert.equal(formatPhone("9801234567", "NP"), "980 123 4567");
    assert.equal(formatPhone("", "AU"), "");
  });

  it("formats international numbers and detects the country", () => {
    assert.equal(formatPhone("+61412345678", "AU"), "+61 412 345 678");
    assert.equal(detectDialCountry("+977 980", "AU"), "NP");
    assert.equal(detectDialCountry("+1 415", "CA"), "CA");
    assert.equal(detectDialCountry("0412", "AU"), null);
  });

  it("stores E.164 and looks up the usual stored forms", () => {
    assert.equal(toE164("0412 345 678", "AU"), "+61412345678");
    assert.equal(toE164("+64 21 123 4567", "AU"), "+64211234567");
    assert.equal(toE164("", "AU"), "");
    assert.deepEqual(phoneVariants("0412 345 678", "AU"), ["+61412345678", "0412345678"]);
  });

  it("checks national length against the selected country", () => {
    assert.equal(phoneLengthIssue("0412", "AU"), "short");
    assert.equal(phoneLengthIssue("0412 345 678", "AU"), null);
    assert.equal(phoneLengthIssue("0412 345 6789", "AU"), "long");
    assert.equal(phoneLengthIssue("980 123 4567", "NP"), null);
    assert.equal(phoneLengthIssue("980 123", "NP"), "short");
    assert.equal(phoneLengthIssue("+61 412 345 678", "AU"), null);
    assert.equal(phoneLengthIssue("1234567890123456", "US"), "long");
    assert.equal(phoneLengthIssue("415 555 2671", "US"), null);
    assert.equal(phoneLengthIssue("", "AU"), null);
  });

  it("defaults the country from the locale", () => {
    assert.equal(countryFromLocale("en-NZ"), "NZ");
    assert.equal(countryFromLocale("en-US"), "US");
    assert.equal(countryFromLocale("en"), "AU");
    assert.equal(countryFromLocale("fr-FR"), "AU");
  });
});
