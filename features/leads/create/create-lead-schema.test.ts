import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MESSAGES,
  createLeadSchema,
  editLeadSchema,
  emptyCreateLead,
  formatAmount,
  leadToForm,
  parseAmount,
  sectionForField,
  toCreatePayload,
  toUpdatePayload,
  valuesForNextLead,
  type CreateLeadDefaults,
  type CreateLeadInput,
} from "./create-lead-schema.ts";
import type { Lead } from "../../../lib/api/crm.ts";

const referral = () => ({
  referrerTypeCode: "existing_customer",
  referrerUserId: "none",
  referrerCustomerId: "none",
  referrerPartnerId: "none",
  referrerName: "",
  relationshipCode: "none",
  referralDate: "2026-10-02",
  referralSource: "",
  notes: "",
  referralCode: "",
});

const defaults: CreateLeadDefaults = {
  source: "Website",
  ownerUserId: "me",
  priority: "medium",
  pipelineId: "p1",
  stageId: "s-created",
  phoneCountry: "AU",
  referral: referral(),
};

const form = (over: Partial<CreateLeadInput> = {}): CreateLeadInput => ({ ...emptyCreateLead(defaults), ...over });

const errorsOf = (input: CreateLeadInput) => {
  const r = createLeadSchema.safeParse(input);
  if (r.success) return {};
  return Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message]));
};

describe("create lead schema", () => {
  it("needs only a name", () => {
    assert.deepEqual(errorsOf(form({ fullName: "Priya Sharma" })), {});
  });

  it("asks for a name in plain words", () => {
    assert.deepEqual(errorsOf(form({ fullName: "   " })), { fullName: MESSAGES.name });
  });

  it("leaves phone and email optional but checks them when given", () => {
    assert.deepEqual(errorsOf(form({ fullName: "A", phone: "0412", email: "priya@" })), {
      phone: MESSAGES.phoneShort,
      email: MESSAGES.email,
    });
    assert.deepEqual(errorsOf(form({ fullName: "A", phone: "0412 345 678", email: "priya@example.com" })), {});
  });

  it("accepts whole amounts only", () => {
    assert.deepEqual(errorsOf(form({ fullName: "A", potentialValue: "25000" })), {});
    assert.deepEqual(errorsOf(form({ fullName: "A", potentialValue: "25.5" })), { potentialValue: MESSAGES.value });
  });

  it("asks who referred the lead only when the source is Referral", () => {
    assert.deepEqual(errorsOf(form({ fullName: "A", source: "Referral" })), { referral: MESSAGES.referrer });
    assert.deepEqual(
      errorsOf(form({ fullName: "A", source: "Referral", referral: { ...referral(), referrerName: "Sam" } })),
      {},
    );
  });

  it("starts with medium priority, me as owner and the default pipeline and stage", () => {
    const v = emptyCreateLead(defaults);
    assert.equal(v.priority, "medium");
    assert.equal(v.ownerUserId, "me");
    assert.equal(v.pipelineId, "p1");
    assert.equal(v.stageId, "s-created");
  });

  it("maps detail fields to the section that should open on an error", () => {
    assert.equal(sectionForField("nextActivityAt"), "sales");
    assert.equal(sectionForField("employer"), "profile");
    assert.equal(sectionForField("notes"), "notes");
    assert.equal(sectionForField("fullName"), null);
    assert.equal(sectionForField("priority"), null);
    assert.equal(sectionForField("anzscoId"), null);
  });
});

describe("create and add another", () => {
  it("keeps source, owner, priority, pipeline and stage, and clears everything else", () => {
    const filled = form({
      fullName: "Priya Sharma",
      phone: "0412 345 678",
      email: "priya@example.com",
      source: "Event",
      potentialValue: "12000",
      priority: "high",
      ownerUserId: "u2",
      pipelineId: "p2",
      stageId: "s2",
      nextActivityAt: "2026-10-03T09:00",
      employer: "Acme",
      notes: "Met at expo",
      phoneCountry: "NZ",
    });
    const next = valuesForNextLead(filled, defaults);
    assert.deepEqual(
      { source: next.source, priority: next.priority, ownerUserId: next.ownerUserId, pipelineId: next.pipelineId, stageId: next.stageId, phoneCountry: next.phoneCountry },
      { source: "Event", priority: "high", ownerUserId: "u2", pipelineId: "p2", stageId: "s2", phoneCountry: "NZ" },
    );
    assert.deepEqual(
      { fullName: next.fullName, phone: next.phone, email: next.email, potentialValue: next.potentialValue, nextActivityAt: next.nextActivityAt, employer: next.employer, notes: next.notes },
      { fullName: "", phone: "", email: "", potentialValue: "", nextActivityAt: "", employer: "", notes: "" },
    );
  });

  it("starts the referral block fresh", () => {
    const filled = form({ fullName: "A", source: "Referral", referral: { ...referral(), referrerName: "Sam" } });
    assert.equal(valuesForNextLead(filled, defaults).referral?.referrerName, "");
  });
});

describe("create payload", () => {
  it("sends E.164 phones, numbers and nulls for blanks", () => {
    const parsed = createLeadSchema.parse(form({ fullName: " Priya ", phone: "0412 345 678", potentialValue: "12500" }));
    const p = toCreatePayload(parsed, { force: false, canAssignOwner: true });
    assert.equal(p.fullName, "Priya");
    assert.equal(p.phone, "+61412345678");
    assert.equal(p.email, null);
    assert.equal(p.potentialValue, 12500);
    assert.equal(p.nextActivityAt, null);
    assert.equal(p.ownerUserId, "me");
    assert.equal("referral" in p, false);
  });

  it("sends the follow-up as 9:00 in the user's time zone", () => {
    const parsed = createLeadSchema.parse(form({ fullName: "A", nextActivityAt: "2026-10-05T09:00" }));
    const p = toCreatePayload(parsed, { force: false, canAssignOwner: true, timeZone: "Australia/Sydney" });
    assert.equal(p.nextActivityAt, "2026-10-04T22:00:00.000Z");
  });

  it("always assigns sales executives to themselves", () => {
    const parsed = createLeadSchema.parse(form({ fullName: "A", ownerUserId: "someone-else" }));
    assert.equal(toCreatePayload(parsed, { force: false, canAssignOwner: false, currentUserId: "me" }).ownerUserId, "me");
  });
});

const existing = (over: Partial<Lead> = {}): Lead =>
  ({
    id: "lead-1",
    fullName: "Priya Sharma",
    email: "priya@example.com",
    phone: "+61412345678",
    country: "Australia",
    nationality: "",
    location: "Sydney",
    ownerUserId: "u2",
    ownerName: "Sam",
    source: "Website",
    priority: "urgent",
    tags: ["vip", "expo"],
    anzscoId: "anz-1",
    pipelineId: "p1",
    stageId: "s2",
    notes: "Met at expo",
    occupation: "Nurse",
    jobTitle: "",
    employer: "Acme",
    potentialValue: 12500.5,
    nextActivityAt: "2026-10-04T22:00:00.000Z",
    ...over,
  }) as Lead;

describe("editing a lead", () => {
  const sydney = { defaultCountry: "US", timeZone: "Australia/Sydney" };

  it("fills the form from the lead, reading the country from the number", () => {
    const v = leadToForm(existing(), sydney);
    assert.equal(v.phoneCountry, "AU");
    assert.equal(v.phone, "+61 412 345 678");
    assert.equal(v.priority, "urgent");
    assert.equal(v.potentialValue, "12501");
    assert.equal(v.nextActivityAt, "2026-10-05T09:00");
    assert.equal(v.tags, "vip, expo");
    assert.equal(v.anzscoId, "anz-1");
  });

  it("doesn't ask for referrer details again", () => {
    const v = { ...leadToForm(existing({ source: "Referral" }), sydney) };
    assert.equal(editLeadSchema.safeParse(v).success, true);
  });

  it("sends nothing but the override flag when nothing changed", () => {
    const initial = leadToForm(existing(), sydney);
    const p = toUpdatePayload(editLeadSchema.parse(initial), initial, { force: false, canAssignOwner: true, timeZone: "Australia/Sydney" });
    assert.deepEqual(p, { forceUpdate: false });
  });

  it("sends only changed fields, and clears with empty values", () => {
    const initial = leadToForm(existing(), sydney);
    const edited = editLeadSchema.parse({
      ...initial,
      fullName: "Priya S",
      email: "",
      potentialValue: "",
      nextActivityAt: "",
      anzscoId: null,
      tags: "vip",
      ownerUserId: "u3",
    });
    assert.deepEqual(toUpdatePayload(edited, initial, { force: true, canAssignOwner: true, timeZone: "Australia/Sydney" }), {
      forceUpdate: true,
      fullName: "Priya S",
      email: "",
      anzscoId: "",
      clearValue: true,
      nextActivityAt: "",
      ownerUserId: "u3",
      tags: ["vip"],
    });
  });

  it("normalises a changed phone and ignores owner changes without permission", () => {
    const initial = leadToForm(existing(), sydney);
    const edited = editLeadSchema.parse({ ...initial, phone: "+61 400 000 000", ownerUserId: "u3" });
    const p = toUpdatePayload(edited, initial, { force: false, canAssignOwner: false });
    assert.equal(p.phone, "+61400000000");
    assert.equal("ownerUserId" in p, false);
  });
});

describe("amount formatting", () => {
  it("formats thousands and parses pasted amounts", () => {
    assert.equal(formatAmount("1250000"), "1,250,000");
    assert.equal(parseAmount("A$12,500.99"), "12500");
    assert.equal(parseAmount("0007"), "7");
    assert.equal(parseAmount(""), "");
  });
});
