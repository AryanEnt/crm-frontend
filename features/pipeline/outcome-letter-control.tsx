"use client";

import type { LeadBoardCard } from "@/lib/api/crm";
import { LeadCardDocControl } from "./lead-card-doc-control";
import { OUTCOME_LETTER_CONFIG } from "./outcome-letter";

/** Compact Outcome-stage control: upload, view, download, or replace a letter (PDF/JPG/PNG). */
export function OutcomeLetterControl({
  lead,
  canEdit,
}: {
  lead: LeadBoardCard;
  canEdit: boolean;
}) {
  return <LeadCardDocControl lead={lead} canEdit={canEdit} config={OUTCOME_LETTER_CONFIG} />;
}
