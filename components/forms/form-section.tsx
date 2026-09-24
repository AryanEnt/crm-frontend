"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Flat section header — no card chrome. Sections are separated by spacing + typography.
 */
export function FormSection({
  title,
  description,
  collapsible = false,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  badge,
  children,
  className,
}: {
  title: string;
  description?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (controlledOpen === undefined) setInternalOpen(next);
  };

  return (
    <section className={cn("space-y-3", className)}>
      {collapsible ? (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
              {badge}
            </div>
            {description ? (
              <p className="mt-0.5 text-[12px] text-foreground-muted">{description}</p>
            ) : null}
          </div>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-foreground-subtle transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      ) : (
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
            {badge}
          </div>
          {description ? (
            <p className="mt-0.5 text-[12px] text-foreground-muted">{description}</p>
          ) : null}
        </div>
      )}
      {open ? <div className="space-y-3.5">{children}</div> : null}
    </section>
  );
}
