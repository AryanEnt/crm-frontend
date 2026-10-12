import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Register custom theme scales so e.g. `text-cell` is merged as a font size, not dropped as a color.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["title", "heading", "body", "cell", "caption", "overline"],
      radius: ["control", "card"],
      ease: ["standard", "emphasis"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** True when a stored code is only a slug of the display name (`website` / Website). */
export function codeEchoesName(name: string, code: string) {
  const normalizedCode = code.trim().toLowerCase();
  if (!normalizedCode) return true;
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const compact = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  return (
    normalizedCode === slug ||
    normalizedCode === compact ||
    normalizedCode === name.trim().toLowerCase()
  );
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatCurrency(value: number, currency = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
