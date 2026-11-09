"use client";

import type { LeadBoardCard } from "@/lib/api/crm";
import { FILE_RECEIVED_CONFIG } from "./file-received";
import { LeadCardDocControl } from "./lead-card-doc-control";

/** Compact File Delivered-stage control: upload, view, download, or replace (PDF/JPG/PNG). */
export function FileReceivedControl({
  lead,
  canEdit,
}: {
  lead: LeadBoardCard;
  canEdit: boolean;
}) {
  return <LeadCardDocControl lead={lead} canEdit={canEdit} config={FILE_RECEIVED_CONFIG} />;
}
