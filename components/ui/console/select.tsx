import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectProps = Omit<React.ComponentProps<"select">, "size"> & {
  invalid?: boolean;
  /** sm = dense rows (28px); md = toolbars (32px); lg = form fields (36px). */
  uiSize?: "sm" | "md" | "lg";
  /** Applied to the wrapper (which also holds the chevron). */
  className?: string;
};

/** Styled native select: native keyboard, screen-reader and mobile behaviour for free. */
export function Select({ invalid, uiSize = "md", className, children, ...props }: SelectProps) {
  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <select
        aria-invalid={invalid || undefined}
        className={cn(
          "w-full min-w-0 cursor-pointer appearance-none rounded-control border border-line bg-surface pl-2.5 pr-8 text-ink shadow-xs transition-[border-color] duration-150 ease-standard hover:border-line-strong focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/25",
          uiSize === "sm" ? "h-7 text-caption" : uiSize === "lg" ? "h-9 text-body" : "h-8 text-body",
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
}
