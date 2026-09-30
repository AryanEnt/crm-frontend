import * as React from "react";
import { cn } from "@/lib/utils";
import type { Tint } from "./tints";

export type BadgeProps = {
  tint?: Tint;
  /** `outline` = neutral pill with a colored dot (default); `soft` = tinted fill for extra emphasis. */
  variant?: "outline" | "soft";
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function Badge({ tint = "slate", variant = "outline", dot = true, className, children }: BadgeProps) {
  return (
    <span
      data-tint={tint}
      className={cn(
        "inline-flex h-5 max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-caption font-medium",
        variant === "outline" ? "border border-line bg-surface text-ink-secondary" : "bg-tint-bg text-tint-fg",
        className,
      )}
    >
      {dot ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-tint-fg" /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const STATUS_DOT: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-ink-subtle",
};

/** Dot + text status (not a filled chip). The label carries meaning; color is reinforcement. */
export function StatusIndicator({
  tone = "neutral",
  className,
  children,
}: {
  tone?: StatusTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap text-cell text-ink-secondary", className)}>
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[tone])} />
      {children}
    </span>
  );
}
