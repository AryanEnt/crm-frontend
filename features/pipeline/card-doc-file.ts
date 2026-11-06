import type { CrmDocument } from "@/lib/api/crm";

export type LeadCardDocControlConfig = {
  /** Document `type` field stored on upload. */
  type: string;
  /** Document `category` field stored on upload. */
  category: string;
  /** Short label used in chips and toasts, e.g. "Outcome letter". */
  label: string;
  /** Empty-state chip text, e.g. "Add outcome letter". */
  addLabel: string;
  /** Match existing docs for this control. */
  match: (d: CrmDocument) => boolean;
  /** Filled chip border/background tone. */
  tone?: "success" | "brand";
};

export const MAX_CARD_DOC_BYTES = 10 * 1024 * 1024;

const ACCEPT_EXT = new Set(["pdf", "jpg", "jpeg", "png"]);
const ACCEPT_MIME = new Set(["application/pdf", "image/jpeg", "image/jpg", "image/png"]);

export function cardDocAcceptAttr(): string {
  return ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
}

/** Returns an error message, or null if the file is acceptable. */
export function validateCardDocFile(file: File, label: string): string | null {
  const mime = (file.type.split(";")[0] ?? "").trim().toLowerCase();
  const ext = file.name.includes(".") ? (file.name.split(".").pop() ?? "").toLowerCase() : "";
  const okMime = ACCEPT_MIME.has(mime);
  const okExt = ACCEPT_EXT.has(ext);
  if (!okMime && !(mime === "application/octet-stream" && okExt) && !okExt) {
    return `${label} must be a PDF, JPG, or PNG file`;
  }
  if (file.size > MAX_CARD_DOC_BYTES) {
    return "That file is over 10 MB. Use a smaller PDF or image.";
  }
  return null;
}

export function pickLatestCardDoc(
  docs: CrmDocument[],
  match: (d: CrmDocument) => boolean,
): CrmDocument | null {
  const hits = docs.filter((d) => match(d) && Boolean(d.fileKey));
  if (hits.length === 0) return null;
  return hits.reduce((best, d) => {
    const a = best.uploadedDate || best.createdAt || "";
    const b = d.uploadedDate || d.createdAt || "";
    return b > a ? d : best;
  });
}
