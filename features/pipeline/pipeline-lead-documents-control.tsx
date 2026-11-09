"use client";

import type { LeadBoardCard } from "@/lib/api/crm";
import { LeadCardDocControl } from "./lead-card-doc-control";
import {
  PIPELINE_LEAD_DOC_CATEGORY,
  PIPELINE_LEAD_DOC_TYPE,
  isPipelineLeadDoc,
  showsAddDocumentSection,
} from "./pipeline-lead-documents";

/** Negotiation → Purchased → Lost: upload/view lead documents that persist across stages. */
export function PipelineLeadDocumentsControl({
  lead,
  stageName,
  canEdit,
}: {
  lead: LeadBoardCard;
  stageName: string | null | undefined;
  canEdit: boolean;
}) {
  if (!showsAddDocumentSection(stageName, lead.status)) return null;
  return (
    <LeadCardDocControl
      lead={lead}
      canEdit={canEdit}
      config={{
        type: PIPELINE_LEAD_DOC_TYPE,
        category: PIPELINE_LEAD_DOC_CATEGORY,
        label: "Documents",
        addLabel: "Add document",
        match: isPipelineLeadDoc,
        tone: "brand",
      }}
    />
  );
}
