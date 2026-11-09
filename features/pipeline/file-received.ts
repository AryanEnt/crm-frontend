import type { CrmDocument } from "@/lib/api/crm";
import { pickLatestCardDoc, type LeadCardDocControlConfig } from "./card-doc-file";

export const FILE_RECEIVED_TYPE = "delivered_file";
export const FILE_RECEIVED_CATEGORY = "file_delivered";

export function isFileReceivedDoc(d: Pick<CrmDocument, "type" | "category">): boolean {
  const t = d.type.trim().toLowerCase();
  const c = d.category.trim().toLowerCase();
  return t === FILE_RECEIVED_TYPE || c === FILE_RECEIVED_CATEGORY;
}

export function pickFileReceived(docs: CrmDocument[]): CrmDocument | null {
  return pickLatestCardDoc(docs, isFileReceivedDoc);
}

export const FILE_RECEIVED_CONFIG: LeadCardDocControlConfig = {
  type: FILE_RECEIVED_TYPE,
  category: FILE_RECEIVED_CATEGORY,
  label: "File received",
  addLabel: "Add file received",
  match: isFileReceivedDoc,
  tone: "brand",
};
