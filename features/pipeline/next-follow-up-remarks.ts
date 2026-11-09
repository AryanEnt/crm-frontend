/** Stages that require a documented next follow-up plan (sales pipeline). */

const REQUIRED_STAGE_NAMES = new Set(["contacted", "negotiation", "purchased", "lost"]);

export function requiresNextFollowUpRemarks(stageName: string | null | undefined): boolean {
  return REQUIRED_STAGE_NAMES.has((stageName ?? "").trim().toLowerCase());
}

export function nextFollowUpRemarksProblem(text: string): string | null {
  if (text.trim() === "") return "Next follow-up remarks are required";
  if (text.trim().length > 2000) return "Keep next follow-up remarks under 2,000 characters";
  return null;
}

export function isNextFollowUpRemarksBlocker(details: {
  reason?: string;
  missingFields?: string[];
  missingActivities?: string[];
  missingDocuments?: string[];
} | null | undefined): boolean {
  if (!details) return false;
  if (details.reason === "next_follow_up_remarks_required") return true;
  const fields = details.missingFields ?? [];
  if (fields.length === 0) return false;
  if ((details.missingActivities?.length ?? 0) > 0 || (details.missingDocuments?.length ?? 0) > 0) {
    return false;
  }
  return fields.every((f) => f.trim().toLowerCase() === "next_follow_up_remarks");
}

export function nextFollowUpRemarksLabel(text: string): string {
  const note = text.trim();
  if (!note) return "";
  return note.length > 96 ? `${note.slice(0, 95)}…` : note;
}
