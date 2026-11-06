/** Contacted-stage star rating + mandatory remarks (mirrors backend contact-rating.ts). */

export const CONTACT_RATING_MIN = 1;
export const CONTACT_RATING_MAX = 5;
export const CONTACT_REMARKS_MIN_UNIQUE_WORDS = 5;

const CONTACT_RATING_FIELD_KEYS = new Set(["contact_rating", "contact_remarks"]);

export function isContactedStage(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === "contacted";
}

/** True when a stage-move error is only asking for contact rating / remarks. */
export function isContactRatingBlocker(details: {
  reason?: string;
  missingFields?: string[];
  missingActivities?: string[];
  missingDocuments?: string[];
} | null | undefined): boolean {
  if (!details) return false;
  if (details.reason === "contact_rating_required") return true;
  const fields = details.missingFields ?? [];
  if (fields.length === 0) return false;
  if ((details.missingActivities?.length ?? 0) > 0 || (details.missingDocuments?.length ?? 0) > 0) {
    return false;
  }
  return fields.every((f) => CONTACT_RATING_FIELD_KEYS.has(f.trim().toLowerCase()));
}

export function contactRemarkWords(text: string): string[] {
  return text
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

export function validContactRemarks(text: string): boolean {
  const words = contactRemarkWords(text);
  if (words.length < CONTACT_REMARKS_MIN_UNIQUE_WORDS) return false;
  return new Set(words).size >= CONTACT_REMARKS_MIN_UNIQUE_WORDS;
}

export function contactRemarksProblem(text: string): string | null {
  const words = contactRemarkWords(text);
  if (words.length === 0) return "Remarks are required";
  if (words.length < CONTACT_REMARKS_MIN_UNIQUE_WORDS) {
    return `Remarks need at least ${CONTACT_REMARKS_MIN_UNIQUE_WORDS} words`;
  }
  if (new Set(words).size < CONTACT_REMARKS_MIN_UNIQUE_WORDS) {
    return `Remarks need at least ${CONTACT_REMARKS_MIN_UNIQUE_WORDS} different words (repeats don't count)`;
  }
  return null;
}

export function contactRatingLabel(rating: number | null | undefined, remarks: string): string {
  if (rating == null || rating < 1) return "";
  const stars = "★".repeat(rating) + "☆".repeat(CONTACT_RATING_MAX - rating);
  const note = remarks.trim();
  return note ? `${stars} · ${note}` : stars;
}
