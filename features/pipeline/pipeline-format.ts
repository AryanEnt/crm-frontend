export function currencySymbol(currency = "AUD"): string {
  try {
    return (
      new Intl.NumberFormat("en-AU", { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency")
        ?.value ?? "$"
    );
  } catch {
    return "$";
  }
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + last).toUpperCase();
}

export type AvatarTone = 1 | 2 | 3 | 4 | 5;

/** Stable pastel per person, so an owner keeps the same colour everywhere. */
export function avatarTone(seed: string | null | undefined): AvatarTone {
  let h = 0;
  for (const ch of seed ?? "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ((h % 5) + 1) as AvatarTone;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
