"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "./tooltip";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BASE =
  "relative inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-control font-medium transition-[color,background-color,border-color,opacity] duration-150 ease-standard disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-primary-foreground shadow-[inset_0_1px_0_0_rgb(255_255_255/0.16),0_1px_2px_0_rgb(15_23_42/0.14)] hover:bg-brand-hover active:bg-brand-active",
  secondary:
    "border border-line bg-surface text-ink shadow-xs hover:border-line-strong hover:bg-surface-muted active:bg-line",
  ghost: "text-ink-secondary hover:bg-surface-muted hover:text-ink active:bg-line",
  danger:
    "bg-danger text-destructive-foreground shadow-[inset_0_1px_0_0_rgb(255_255_255/0.14)] hover:bg-danger/90 active:bg-danger/80",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-caption",
  md: "h-8 px-3 text-cell",
};

export type ButtonProps = React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  type = "button",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

const ICON_SIZES: Record<ButtonSize, string> = { sm: "size-7", md: "size-8" };

export type IconButtonProps = Omit<ButtonProps, "children" | "aria-label"> & {
  /** Accessible name; also shown as the tooltip. */
  label: string;
  children: React.ReactNode;
  tooltip?: boolean;
};

export function IconButton({
  label,
  variant = "ghost",
  size = "md",
  tooltip = true,
  className,
  children,
  ...props
}: IconButtonProps) {
  const button = (
    <Button
      variant={variant}
      size={size}
      aria-label={label}
      className={cn(ICON_SIZES[size], "px-0", className)}
      {...props}
    >
      {children}
    </Button>
  );
  return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button;
}
