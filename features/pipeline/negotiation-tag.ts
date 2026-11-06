/** Predefined Negotiation-stage tags on the Leads Pipeline board. */
export const NEGOTIATION_TAGS = [
  "Budget Concern",
  "Payment Scheduled",
  "Gone Quiet",
  "Follow-up Scheduled",
  "Others",
] as const;

export type NegotiationTag = (typeof NEGOTIATION_TAGS)[number];

export type NegotiationTagTone = "warning" | "success" | "danger" | "info" | "neutral";

/** Short copy so new SEs know what each tag means. */
export const NEGOTIATION_TAG_META: Record<
  NegotiationTag,
  { hint: string; tone: NegotiationTagTone }
> = {
  "Budget Concern": {
    hint: "Price or affordability is blocking the deal",
    tone: "warning",
  },
  "Payment Scheduled": {
    hint: "Customer agreed — payment date is set",
    tone: "success",
  },
  "Gone Quiet": {
    hint: "Stopped responding; needs a chase",
    tone: "danger",
  },
  "Follow-up Scheduled": {
    hint: "Next call or meeting is already booked",
    tone: "info",
  },
  Others: {
    hint: "Something else — add a short note",
    tone: "neutral",
  },
};

export function isNegotiationTag(value: string): value is NegotiationTag {
  return (NEGOTIATION_TAGS as readonly string[]).includes(value);
}

export function isNegotiationStage(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === "negotiation";
}

/** Label shown on the card when a tag (and optional Others remarks) is set. */
export function negotiationTagLabel(tag: string, remarks: string): string {
  if (!tag) return "";
  if (tag === "Others") {
    const note = remarks.trim();
    return note ? `Others · ${note}` : "Others";
  }
  return tag;
}

export function negotiationTagTone(tag: string): NegotiationTagTone {
  return isNegotiationTag(tag) ? NEGOTIATION_TAG_META[tag].tone : "neutral";
}
