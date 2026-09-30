export const TINTS = ["teal", "sky", "indigo", "violet", "rose", "amber", "emerald", "slate"] as const;

export type Tint = (typeof TINTS)[number];

const HASHED_TINTS: readonly Tint[] = TINTS.filter((tint) => tint !== "slate");

/** Deterministic tint for a string key (name, role code), so colors stay stable across sessions. */
export function tintFor(key: string): Tint {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return HASHED_TINTS[Math.abs(hash) % HASHED_TINTS.length] ?? "slate";
}
