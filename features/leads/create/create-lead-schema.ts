import { z } from "zod";
import type { Lead } from "../../../lib/api/crm.ts";
import { emptyReferralForm, toReferralInput, type ReferralFormState } from "../../referrals/referral-form.ts";
import { fromLocalInput, isoToZonedInput, zonedInputToIso } from "./follow-up.ts";
import { detectDialCountry, formatPhone } from "./phone.ts";

/** The choices offered for new leads. */
export const CREATE_LEAD_PRIORITIES = ["low", "medium", "high"] as const;
/** Older leads can also be "urgent"; editing keeps that value. */
export const LEAD_PRIORITY_VALUES = ["low", "medium", "high", "urgent"] as const;
export type CreateLeadPriority = (typeof LEAD_PRIORITY_VALUES)[number];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string) {
  return EMAIL.test(value.trim());
}

export function isReferralSource(source: string | undefined) {
  return source?.trim().toLowerCase() === "referral";
}

/** Optional follow-up for a source chip. Referral has its own referrer block instead. */
export function sourceDetailPrompt(source: string | undefined): { label: string; placeholder: string } | null {
  const name = source?.trim() ?? "";
  if (!name || isReferralSource(name)) return null;
  const key = name.toLowerCase().replace(/[-_]+/g, " ");
  const prompts: Record<string, { label: string; placeholder: string }> = {
    website: { label: "Which website?", placeholder: "company.com or the page they visited" },
    facebook: { label: "Which Facebook page or ad?", placeholder: "Page, group, or campaign name" },
    instagram: { label: "Which Instagram account or ad?", placeholder: "Handle or campaign name" },
    google: { label: "Which Google listing or ad?", placeholder: "Search term, listing, or campaign" },
    whatsapp: { label: "Any WhatsApp details?", placeholder: "Group, number, or campaign" },
    email: { label: "Which campaign or inbox?", placeholder: "Newsletter, signature, or mailbox" },
    event: { label: "Which event?", placeholder: "Expo, webinar, or open day" },
    partner: { label: "Which partner?", placeholder: "Agency or partner name" },
    agent: { label: "Which agent?", placeholder: "Agent or consultant name" },
    "walk in": { label: "Which office?", placeholder: "Branch or location" },
    "cold call": { label: "Anything about the call?", placeholder: "List or campaign, if you have it" },
    phone: { label: "Anything about the call?", placeholder: "List or campaign, if you have it" },
  };
  return prompts[key] ?? { label: `Anything else about this ${name}?`, placeholder: "Campaign, page, or how you met" };
}

export function parseSourceNote(source: string, notes: string): { sourceDetail: string; notes: string } {
  const prefix = `${source}: `;
  if (!source || !notes.startsWith(prefix)) return { sourceDetail: "", notes };
  const rest = notes.slice(prefix.length);
  const nl = rest.indexOf("\n");
  if (nl < 0) return { sourceDetail: rest.trim(), notes: "" };
  return { sourceDetail: rest.slice(0, nl).trim(), notes: rest.slice(nl + 1).replace(/^\n/, "") };
}

export function mergeSourceNote(source: string, detail: string | undefined, notes: string): string {
  const d = (detail ?? "").trim();
  const n = notes.replace(/^\n+/, "");
  if (!d || isReferralSource(source)) return n;
  return n ? `${source}: ${d}\n${n}` : `${source}: ${d}`;
}

/** Same rule as the backend: a linked referrer or a typed name. */
export function hasReferrer(r: ReferralFormState | undefined) {
  if (!r) return false;
  const linked = (id: string) => Boolean(id) && id !== "none";
  return linked(r.referrerUserId) || linked(r.referrerCustomerId) || linked(r.referrerPartnerId) || Boolean(r.referrerName.trim());
}

export const MESSAGES = {
  name: "Add a name to continue",
  email: "Enter a valid email, for example name@example.com",
  phoneShort: "This number looks too short for the selected country",
  phoneLong: "This number looks too long for the selected country",
  source: "Choose where this lead came from",
  value: "Enter a whole amount, like 25,000",
  referrer: "Add who referred this lead",
  followUp: "Pick a follow-up date",
  country: "Choose their country",
  nationality: "Add their nationality",
  location: "Add where they are (city or suburb)",
} as const;

/**
 * Name plus where they are (country, nationality, location) are required on create and edit.
 * Source is required by the API, but it always starts filled (last used, org default
 * or "Other"), so nobody has to touch it. Referral source still needs a referrer on
 * create and edit.
 */
export function leadSheetSchema(_mode: "create" | "edit") {
  return z
    .object({
      fullName: z.string().trim().min(1, MESSAGES.name),
      phoneCountry: z.string(),
      phone: z.string().trim(),
      email: z
        .string()
        .trim()
        .refine((v) => !v || EMAIL.test(v), MESSAGES.email),
      source: z.string().trim().min(1, MESSAGES.source),
      potentialValue: z
        .string()
        .trim()
        .refine((v) => !v || /^\d{1,13}$/.test(v), MESSAGES.value),
      priority: z.enum(LEAD_PRIORITY_VALUES),
      ownerUserId: z.string(),
      pipelineId: z.string(),
      stageId: z.string(),
      nextActivityAt: z.string().refine((v) => !v || fromLocalInput(v) !== null, MESSAGES.followUp),
      country: z.string().trim().min(1, MESSAGES.country),
      nationality: z.string().trim().min(1, MESSAGES.nationality),
      location: z.string().trim().min(1, MESSAGES.location),
      occupation: z.string().trim(),
      jobTitle: z.string().trim(),
      employer: z.string().trim(),
      anzscoId: z.string().nullable(),
      notes: z.string(),
      tags: z.string(),
      sourceDetail: z.string(),
      referral: z.custom<ReferralFormState>().optional(),
    })
    .superRefine((v, ctx) => {
      // Phone format / duplicates are validated asynchronously after save — never block create/edit.
      if (isReferralSource(v.source) && !hasReferrer(v.referral)) {
        ctx.addIssue({ code: "custom", path: ["referral"], message: MESSAGES.referrer });
      }
    });
}

export const createLeadSchema = leadSheetSchema("create");
export const editLeadSchema = leadSheetSchema("edit");

export type CreateLeadInput = z.input<typeof createLeadSchema>;
export type CreateLeadValues = z.output<typeof createLeadSchema>;

/** Starting values the user should never have to touch. */
export type CreateLeadDefaults = {
  source: string;
  ownerUserId: string;
  priority: CreateLeadPriority;
  pipelineId: string;
  stageId: string;
  phoneCountry: string;
  /** A fresh referral block, used when the source is Referral. */
  referral: ReferralFormState;
};

export function emptyCreateLead(d: CreateLeadDefaults): CreateLeadInput {
  return {
    fullName: "",
    phoneCountry: d.phoneCountry,
    phone: "",
    email: "",
    source: d.source,
    potentialValue: "",
    priority: d.priority,
    ownerUserId: d.ownerUserId,
    pipelineId: d.pipelineId,
    stageId: d.stageId,
    nextActivityAt: "",
    country: "",
    nationality: "",
    location: "",
    occupation: "",
    jobTitle: "",
    employer: "",
    anzscoId: null,
    notes: "",
    tags: "",
    sourceDetail: "",
    referral: d.referral,
  };
}

/** An existing lead as form values, for editing. */
export function leadToForm(
  lead: Lead,
  o: { defaultCountry: string; timeZone?: string; referral?: ReferralFormState },
): CreateLeadInput {
  const phone = lead.phone?.trim() ?? "";
  const phoneCountry = detectDialCountry(phone, o.defaultCountry) ?? o.defaultCountry;
  const priority = (LEAD_PRIORITY_VALUES as readonly string[]).includes(lead.priority)
    ? (lead.priority as CreateLeadPriority)
    : "medium";
  const sourceNote = parseSourceNote(lead.source ?? "", lead.notes ?? "");
  return {
    fullName: lead.fullName ?? "",
    phoneCountry,
    phone: phone ? formatPhone(phone, phoneCountry) : "",
    email: lead.email ?? "",
    source: lead.source ?? "",
    potentialValue: lead.potentialValue != null ? String(Math.round(lead.potentialValue)) : "",
    priority,
    ownerUserId: lead.ownerUserId ?? "",
    pipelineId: lead.pipelineId ?? "",
    stageId: lead.stageId ?? "",
    nextActivityAt: isoToZonedInput(lead.nextActivityAt, o.timeZone),
    country: lead.country ?? "",
    nationality: lead.nationality ?? "",
    location: lead.location ?? "",
    occupation: lead.occupation ?? "",
    jobTitle: lead.jobTitle ?? "",
    employer: lead.employer ?? "",
    anzscoId: lead.anzscoId ?? null,
    notes: sourceNote.notes,
    tags: (lead.tags ?? []).join(", "),
    sourceDetail: sourceNote.sourceDetail,
    referral: o.referral ?? emptyReferralForm(),
  };
}

/** Carried over by "Create and add another"; everything else starts blank. */
export const KEPT_FOR_NEXT_LEAD = ["source", "ownerUserId", "priority", "pipelineId", "stageId", "phoneCountry"] as const;

export function valuesForNextLead(prev: CreateLeadInput, d: CreateLeadDefaults): CreateLeadInput {
  const next = emptyCreateLead(d);
  for (const key of KEPT_FOR_NEXT_LEAD) (next[key] as unknown) = prev[key];
  return next;
}

/** Fields that live in the collapsed "More details" sections, by section. Country / nationality / location / ANZSCO sit above. */
export const DETAIL_SECTION_FIELDS = {
  sales: ["ownerUserId", "pipelineId", "stageId", "nextActivityAt"],
  work: ["occupation", "jobTitle", "employer"],
  notes: ["notes", "tags"],
} as const;

export type DetailSection = keyof typeof DETAIL_SECTION_FIELDS;

export function sectionForField(field: string): DetailSection | null {
  for (const [section, fields] of Object.entries(DETAIL_SECTION_FIELDS)) {
    if ((fields as readonly string[]).includes(field)) return section as DetailSection;
  }
  return null;
}

export function parseTags(raw: string): string[] {
  return Array.from(new Set(raw.split(",").map((t) => t.trim()).filter(Boolean)));
}

/** Body for POST /leads. The API rejects unknown fields, so only known keys are sent. */
export function toCreatePayload(
  v: CreateLeadValues,
  opts: {
    force: boolean;
    canAssignOwner: boolean;
    currentUserId?: string;
    referral?: unknown;
    timeZone?: string;
    customFields?: Record<string, unknown>;
  },
): Record<string, unknown> {
  const id = (s: string) => (s && s !== "none" ? s : null);
  return {
    fullName: v.fullName,
    email: v.email || null,
    // Keep the user's input (formatted for readability); server validates asynchronously.
    phone: (v.phone.trim() ? formatPhone(v.phone, v.phoneCountry) || v.phone.trim() : null),
    phoneCountryCode: v.phoneCountry || null,
    country: v.country,
    nationality: v.nationality,
    location: v.location,
    source: v.source,
    priority: v.priority,
    tags: parseTags(v.tags),
    anzscoId: v.anzscoId || null,
    notes: mergeSourceNote(v.source, v.sourceDetail, v.notes),
    occupation: v.occupation,
    jobTitle: v.jobTitle,
    employer: v.employer,
    potentialValue: v.potentialValue ? Number(v.potentialValue) : null,
    nextActivityAt: v.nextActivityAt ? zonedInputToIso(v.nextActivityAt, opts.timeZone) : null,
    pipelineId: id(v.pipelineId),
    stageId: id(v.stageId),
    ownerUserId: opts.canAssignOwner ? (id(v.ownerUserId) ?? "") : (opts.currentUserId ?? ""),
    forceCreate: opts.force,
    ...(opts.customFields && Object.keys(opts.customFields).length ? { customFields: opts.customFields } : {}),
    ...(isReferralSource(v.source) && opts.referral ? { referral: opts.referral } : {}),
  };
}

const TEXT_FIELDS = ["fullName", "country", "nationality", "location", "source", "priority", "occupation", "jobTitle", "employer"] as const;

/**
 * Body for PATCH /leads/:id with only what changed. The API leaves omitted fields alone
 * and clears a field sent as "". Untouched phones keep their stored format. Stage
 * changes go through the board or the lead panel, which handle stage requirements.
 */
export function toUpdatePayload(
  v: CreateLeadValues,
  initial: CreateLeadInput,
  opts: { force: boolean; canAssignOwner: boolean; timeZone?: string; customFields?: Record<string, unknown> },
): Record<string, unknown> {
  const p: Record<string, unknown> = { forceUpdate: opts.force };
  const differs = (a: unknown, b: unknown) => String(a ?? "").trim() !== String(b ?? "").trim();

  for (const key of TEXT_FIELDS) if (differs(v[key], initial[key])) p[key] = v[key];
  if (differs(v.email, initial.email)) p.email = v.email;
  if (differs(v.phone, initial.phone) || (v.phone && v.phoneCountry !== initial.phoneCountry)) {
    p.phone = v.phone.trim() ? formatPhone(v.phone, v.phoneCountry) || v.phone.trim() : "";
    p.phoneCountryCode = v.phoneCountry || "";
  }
  if (differs(v.anzscoId, initial.anzscoId)) p.anzscoId = v.anzscoId ?? "";
  if (differs(v.potentialValue, initial.potentialValue)) {
    if (v.potentialValue) p.potentialValue = Number(v.potentialValue);
    else p.clearValue = true;
  }
  if (differs(v.nextActivityAt, initial.nextActivityAt)) {
    p.nextActivityAt = v.nextActivityAt ? zonedInputToIso(v.nextActivityAt, opts.timeZone) : "";
  }
  const nextNotes = mergeSourceNote(v.source, v.sourceDetail, v.notes);
  const prevNotes = mergeSourceNote(initial.source, initial.sourceDetail, initial.notes);
  if (differs(nextNotes, prevNotes)) p.notes = nextNotes;
  if (opts.canAssignOwner && differs(v.ownerUserId, initial.ownerUserId)) p.ownerUserId = v.ownerUserId;
  if (parseTags(v.tags).join(",") !== parseTags(initial.tags).join(",")) p.tags = parseTags(v.tags);
  if (opts.customFields && Object.keys(opts.customFields).length) p.customFields = opts.customFields;
  if (isReferralSource(v.source) && v.referral) {
    const next = toReferralInput(v.referral);
    const prev = initial.referral ? toReferralInput(initial.referral) : null;
    if (!prev || JSON.stringify(next) !== JSON.stringify(prev)) p.referral = next;
  }
  return p;
}

/** "12500" -> "12,500" for display; the form keeps plain digits. */
export function formatAmount(digits: string): string {
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Whatever was typed or pasted ("A$12,500.00") -> "12500". */
export function parseAmount(raw: string): string {
  const whole = raw.split(".")[0] ?? "";
  return whole.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 13);
}
