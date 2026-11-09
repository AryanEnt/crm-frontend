import type { CrmDocument } from "@/lib/api/crm";
import { pickLatestCardDoc, type LeadCardDocControlConfig } from "./card-doc-file";

export const OUTCOME_LETTER_TYPE = "outcome_letter";
export const OUTCOME_LETTER_CATEGORY = "outcome_letter";

export function isOutcomeLetterDoc(d: Pick<CrmDocument, "type" | "category">): boolean {
  const t = d.type.trim().toLowerCase();
  const c = d.category.trim().toLowerCase();
  return t === OUTCOME_LETTER_TYPE || c === OUTCOME_LETTER_CATEGORY;
}

export function pickOutcomeLetter(docs: CrmDocument[]): CrmDocument | null {
  return pickLatestCardDoc(docs, isOutcomeLetterDoc);
}

export const OUTCOME_LETTER_CONFIG: LeadCardDocControlConfig = {
  type: OUTCOME_LETTER_TYPE,
  category: OUTCOME_LETTER_CATEGORY,
  label: "Outcome letter",
  addLabel: "Add outcome letter",
  match: isOutcomeLetterDoc,
  tone: "success",
};
