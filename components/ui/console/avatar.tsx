import { cn } from "@/lib/utils";
import { tintFor } from "./tints";

export function initialsFor(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.charAt(0) ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

const SIZES = {
  sm: "size-6 text-[0.625rem]",
  md: "size-8 text-caption",
  lg: "size-10 text-body",
} as const;

export type AvatarProps = {
  name: string;
  size?: keyof typeof SIZES;
  /** Set when the avatar stands alone; omit when the name is rendered next to it. */
  label?: string;
  className?: string;
};

export function Avatar({ name, size = "md", label, className }: AvatarProps) {
  return (
    <span
      data-tint={tintFor(name.trim().toLowerCase())}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full bg-tint-bg font-semibold text-tint-fg",
        SIZES[size],
        className,
      )}
    >
      {initialsFor(name)}
    </span>
  );
}
