import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-8 w-full rounded-[var(--radius-md)] border bg-surface px-2.5 text-sm text-foreground transition-colors",
        "placeholder:text-foreground-subtle",
        "hover:border-border-strong",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-danger",
        error
          ? "border-destructive focus-visible:ring-destructive"
          : "border-border",
        className,
      )}
      ref={ref}
      aria-invalid={error || props["aria-invalid"]}
      {...props}
    />
  ),
);
Input.displayName = "Input";
