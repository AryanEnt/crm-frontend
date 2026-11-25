/** Country, nationality, and phone required on Contacted → Negotiation (mirrors backend). */

export const NEGOTIATION_PROFILE_FIELDS = ["country", "nationality", "phone"] as const;

export type NegotiationProfileField = (typeof NEGOTIATION_PROFILE_FIELDS)[number];

const FIELD_KEYS = new Set<string>(NEGOTIATION_PROFILE_FIELDS);

export function isNegotiationProfileField(key: string): key is NegotiationProfileField {
  return FIELD_KEYS.has(key.trim().toLowerCase());
}

/** True when a stage-move error is only asking for country / nationality / phone. */
export function isNegotiationProfileBlocker(details: {
  reason?: string;
  missingFields?: string[];
  missingActivities?: string[];
  missingDocuments?: string[];
} | null | undefined): boolean {
  if (!details) return false;
  if (details.reason === "negotiation_profile_required") return true;
  const fields = details.missingFields ?? [];
  if (fields.length === 0) return false;
  if ((details.missingActivities?.length ?? 0) > 0 || (details.missingDocuments?.length ?? 0) > 0) {
    return false;
  }
  return fields.every((f) => isNegotiationProfileField(f));
}

export function negotiationProfileMissing(details: {
  missingFields?: string[];
} | null | undefined): NegotiationProfileField[] {
  const fields = (details?.missingFields ?? [])
    .map((f) => f.trim().toLowerCase())
    .filter(isNegotiationProfileField);
  if (fields.length > 0) return [...new Set(fields)];
  return [...NEGOTIATION_PROFILE_FIELDS];
}
