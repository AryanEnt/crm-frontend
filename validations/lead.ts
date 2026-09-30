import { z } from "zod";
import { emailSchema } from "@/validations/common";
import { messages } from "@/lib/forms/messages";

export const LEAD_SOURCES = [
  "Website",
  "Referral",
  "Cold call",
  "Event",
  "Partner",
  "Social",
  "Other",
] as const;

export const LEAD_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

/** Mirrors `ReferralFormState`; "none" marks an unset referrer id. */
export const leadReferralSchema = z.object({
  referrerTypeCode: z.string(),
  referrerUserId: z.string(),
  referrerCustomerId: z.string(),
  referrerPartnerId: z.string(),
  referrerName: z.string(),
  relationshipCode: z.string(),
  referralDate: z.string(),
  referralSource: z.string(),
  notes: z.string(),
  referralCode: z.string(),
});

export function isReferralSource(source: string | undefined) {
  return source?.trim().toLowerCase() === "referral";
}

/** Same rule as the backend's referrals.ValidateRequired: a linked referrer or a typed name. */
export function hasReferrer(r: z.input<typeof leadReferralSchema>) {
  const linked = (id: string) => Boolean(id) && id !== "none";
  return (
    linked(r.referrerUserId) ||
    linked(r.referrerCustomerId) ||
    linked(r.referrerPartnerId) ||
    Boolean(r.referrerName.trim())
  );
}

/**
 * `referral` is only present on create; the lead update endpoint doesn't accept
 * referral details, so edit leaves it undefined and skips the referrer rule.
 */
export const leadFormSchema = z
  .object({
    fullName: z.string().trim().min(1, messages.enter("the lead's name")),
    email: z
      .string()
      .trim()
      .refine((v) => !v || emailSchema.safeParse(v).success, messages.email),
    phone: z.string().trim(),
    country: z.string(),
    nationality: z.string().trim(),
    location: z.string().trim(),
    source: z.string().trim().min(1, messages.choose("where this lead came from")),
    priority: z.enum(LEAD_PRIORITIES),
    ownerUserId: z.string(),
    teamId: z.string(),
    pipelineId: z.string(),
    stageId: z.string(),
    anzscoId: z.string().nullable(),
    occupation: z.string().trim(),
    jobTitle: z.string().trim(),
    employer: z.string().trim(),
    potentialValue: z
      .string()
      .trim()
      .refine((v) => !v || (Number.isFinite(Number(v)) && Number(v) >= 0), "Enter an amount of 0 or more"),
    tags: z.string(),
    notes: z.string(),
    nextActivityAt: z.string(),
    referral: leadReferralSchema.optional(),
  })
  .refine((d) => !isReferralSource(d.source) || !d.referral || hasReferrer(d.referral), {
    message: "Choose who referred this lead, or type their name",
    path: ["referral", "referrerName"],
    when: () => true,
  });

export type LeadFormInput = z.input<typeof leadFormSchema>;
export type LeadFormValues = z.output<typeof leadFormSchema>;
