import type { CrmDocument } from "@/lib/api/crm";

export const PIPELINE_LEAD_DOC_TYPE = "lead_document";
export const PIPELINE_LEAD_DOC_CATEGORY = "pipeline";

const STAGE_NAMES = new Set(["negotiation", "purchased", "lost"]);

function isNurturingOnlyStage(stageName: string): boolean {
  const n = stageName.trim().toLowerCase();
  return n === "outcome" || n === "file delivered" || n === "documents sent" || n === "clients";
}

/** True for general pipeline files attached from Negotiation → Lost (not screenshots / nurturing docs). */
export function isPipelineLeadDoc(d: Pick<CrmDocument, "type" | "category">): boolean {
  const t = d.type.trim().toLowerCase();
  const c = d.category.trim().toLowerCase();
  return t === PIPELINE_LEAD_DOC_TYPE || c === PIPELINE_LEAD_DOC_CATEGORY;
}

/**
 * Negotiation, Purchased, and Lost cards show Add Document.
 * Docs stay on the lead, so they remain visible after stage moves.
 * Nurturing-only stages keep their own file controls instead.
 */
export function showsAddDocumentSection(
  stageName: string | null | undefined,
  status?: string | null,
): boolean {
  const name = (stageName ?? "").trim();
  if (isNurturingOnlyStage(name)) return false;

  const key = name.toLowerCase();
  if (STAGE_NAMES.has(key)) return true;

  const s = (status ?? "").trim().toLowerCase();
  if (s === "lost") return true;
  if (s === "won" && (key === "" || key === "won" || key === "purchased")) return true;
  return false;
}
