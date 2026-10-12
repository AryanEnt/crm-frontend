/** How a document can be shown in the app. Mirrors the backend's inline allowlist. */
export type PreviewKind = "image" | "pdf" | "text" | "video" | "audio" | "none";

const BY_EXTENSION: Record<string, Exclude<PreviewKind, "none">> = {
  pdf: "pdf",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  bmp: "image",
  avif: "image",
  txt: "text",
  csv: "text",
  mp4: "video",
  webm: "video",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  m4a: "audio",
};

const BY_TYPE: Record<string, Exclude<PreviewKind, "none">> = {
  "application/pdf": "pdf",
  "image/png": "image",
  "image/jpeg": "image",
  "image/gif": "image",
  "image/webp": "image",
  "image/bmp": "image",
  "image/avif": "image",
  "text/plain": "text",
  "text/csv": "text",
  "video/mp4": "video",
  "video/webm": "video",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "audio/ogg": "audio",
  "audio/mp4": "audio",
};

export function previewKind(doc: { mimeType?: string | null; name?: string | null }): PreviewKind {
  const mime = (doc.mimeType ?? "").split(";")[0]!.trim().toLowerCase();
  const known = BY_TYPE[mime];
  if (known) return known;
  if (mime !== "" && mime !== "application/octet-stream") return "none";
  const ext = (doc.name ?? "").toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  return BY_EXTENSION[ext] ?? "none";
}
