import { z } from "zod";
import { messages } from "@/lib/forms/messages";

export const ACTIVITY_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const ACTIVITY_LINK_TYPES = ["customer", "lead", "deal"] as const;
export type ActivityLinkType = (typeof ACTIVITY_LINK_TYPES)[number];

/** Per-type form rules configured in Admin → Activity types; the backend doesn't enforce them. */
export type ActivityTypeRules = {
  datetime: boolean;
  duration: boolean;
  outcome: boolean;
  notes: boolean;
};

/**
 * Built per render from the selected type's rules so required markers and
 * messages follow the type. `needsLink` is false when the caller supplies the record.
 */
export function activitySchema(rules: ActivityTypeRules, { needsLink }: { needsLink: boolean }) {
  const schedule = rules.duration ? "duration" : rules.datetime ? "datetime" : "none";
  return z
    .object({
      linkType: z.enum(ACTIVITY_LINK_TYPES),
      linkId: needsLink ? z.string().min(1, "Choose the record this activity is for") : z.string(),
      linkCustomerId: z.string(),
      typeCode: z.string().min(1, messages.choose("an activity type")),
      priority: z.enum(ACTIVITY_PRIORITIES),
      dueAt: schedule === "datetime" ? z.string().min(1, messages.enter("a date and time")) : z.string(),
      startAt: schedule === "duration" ? z.string().min(1, messages.enter("a start time")) : z.string(),
      endAt: schedule === "duration" ? z.string().min(1, messages.enter("an end time")) : z.string(),
      title: z.string().trim(),
      outcome: rules.outcome ? z.string().trim().min(1, messages.enter("the outcome")) : z.string().trim(),
      notes: rules.notes ? z.string().trim().min(1, messages.enter("notes")) : z.string(),
    })
    .refine(
      (d) =>
        schedule !== "duration" || !d.startAt || !d.endAt || new Date(d.endAt).getTime() > new Date(d.startAt).getTime(),
      { message: "Choose an end time after the start", path: ["endAt"], when: () => true },
    );
}

export type ActivityFormInput = z.input<ReturnType<typeof activitySchema>>;
export type ActivityFormValues = z.output<ReturnType<typeof activitySchema>>;
