import { z } from "zod";
import { emailSchema } from "@/validations/common";

export const LEAD_SOURCES = [
  "Website",
  "Referral",
  "Cold call",
  "Event",
  "Partner",
  "Social",
  "Other",
] as const;

export const leadReferralSchema = z.object({
  referrerTypeCode: z.string().min(1, "Referrer type is required"),
  referrerUserId: z.string().optional(),
  referrerCustomerId: z.string().optional(),
  referrerPartnerId: z.string().optional(),
  referrerName: z.string().optional(),
  relationshipCode: z.string().optional(),
  referralDate: z.string().min(1, "Referral date is required"),
  referralSource: z.string().optional(),
  notes: z.string().optional(),
  referralCode: z.string().optional(),
});

/** Shared lead form values for quick / guided / full / edit. */
export const leadFormSchema = z
  .object({
    fullName: z.string().trim().min(1, "Full name is required"),
    email: z
      .string()
      .trim()
      .refine((v) => !v || emailSchema.safeParse(v).success, "Please enter a valid email address"),
    phone: z.string().optional(),
    country: z.string().optional(),
    nationality: z.string().optional(),
    location: z.string().optional(),
    source: z.string().trim().min(1, "Lead source is required"),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    ownerUserId: z.string().optional(),
    teamId: z.string().optional(),
    pipelineId: z.string().optional(),
    stageId: z.string().optional(),
    anzscoId: z.string().nullable().optional(),
    occupation: z.string().optional(),
    jobTitle: z.string().optional(),
    employer: z.string().optional(),
    potentialValue: z.string().optional(),
    tags: z.string().optional(),
    notes: z.string().optional(),
    nextActivityAt: z.string().optional(),
    referral: leadReferralSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.source.trim().toLowerCase() === "referral") {
      if (!data.referral) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Referral details are required",
          path: ["referral"],
        });
        return;
      }
      const r = data.referral;
      const hasLink =
        (r.referrerUserId && r.referrerUserId !== "none") ||
        (r.referrerCustomerId && r.referrerCustomerId !== "none") ||
        (r.referrerPartnerId && r.referrerPartnerId !== "none") ||
        Boolean(r.referrerName?.trim());
      if (!hasLink) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select or enter who referred this lead",
          path: ["referral", "referrerName"],
        });
      }
    }
  });

export type LeadFormValues = z.infer<typeof leadFormSchema>;

export const LEAD_GUIDED_STEPS = [
  { id: "basic", label: "Basic Information" },
  { id: "qualification", label: "Qualification" },
  { id: "sales", label: "Sales Setup" },
] as const;
