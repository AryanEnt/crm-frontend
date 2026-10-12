export const typeDot: Record<string, string> = {
  slate: "bg-foreground-muted",
  blue: "bg-info",
  teal: "bg-brand",
  green: "bg-success",
  amber: "bg-warning",
  orange: "bg-warning",
  rose: "bg-destructive",
  violet: "bg-orchid",
  neutral: "bg-foreground-subtle",
};

/** Outline variant of typeDot, for types that share a colour with another (SMS next to email). */
export const typeRing: Record<string, string> = {
  slate: "border-foreground-muted",
  blue: "border-info",
  teal: "border-brand",
  green: "border-success",
  amber: "border-warning",
  orange: "border-warning",
  rose: "border-destructive",
  violet: "border-orchid",
  neutral: "border-foreground-subtle",
};

/** Time-grid blocks: tinted fill with a solid accent edge in the type colour. */
export const typeBlock: Record<string, string> = {
  slate: "border-l-foreground-muted bg-surface-muted",
  blue: "border-l-info bg-info/10",
  teal: "border-l-brand bg-brand-soft",
  green: "border-l-success bg-success/10",
  amber: "border-l-warning bg-warning/10",
  orange: "border-l-warning bg-warning/10",
  rose: "border-l-destructive bg-destructive/10",
  violet: "border-l-orchid bg-orchid-soft",
  neutral: "border-l-foreground-subtle bg-surface-muted",
};

export const colorOf = <T>(map: Record<string, T>, color?: string | null) =>
  map[color ?? "slate"] ?? map.slate;

const HOLLOW_KINDS = new Set(["sms"]);

export function typeDotClass(kind: string | null | undefined, color?: string | null) {
  return kind && HOLLOW_KINDS.has(kind) ? `border-[1.5px] ${colorOf(typeRing, color)}` : colorOf(typeDot, color);
}

/** Overdue stays off amber, which the follow-up type uses. */
export const statusTone = (s: string) =>
  s === "overdue"
    ? "danger"
    : s === "completed"
      ? "success"
      : s === "cancelled"
        ? "neutral"
        : s === "due"
          ? "brand"
          : "info";
