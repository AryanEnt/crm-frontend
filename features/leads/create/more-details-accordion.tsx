"use client";

import * as React from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AccordionSection<T extends string> = {
  id: T;
  title: string;
  icon: LucideIcon;
  /** One line shown under the title once something in the section is filled. */
  summary?: string;
  /** Shown instead of the summary while the section is empty. */
  placeholder: string;
  invalid?: boolean;
  content: React.ReactNode;
};

/**
 * Collapsed sections stay mounted (so their values and pickers keep state) but are
 * `inert`, which keeps them out of the tab order and away from screen readers.
 */
export function MoreDetailsAccordion<T extends string>({
  sections,
  open,
  onToggle,
}: {
  sections: AccordionSection<T>[];
  open: ReadonlySet<T>;
  onToggle: (id: T) => void;
}) {
  const baseId = React.useId();
  return (
    <div className="flex flex-col gap-2.5">
      {sections.map((s) => {
        const expanded = open.has(s.id);
        const panelId = `${baseId}-${s.id}-panel`;
        const buttonId = `${baseId}-${s.id}-button`;
        const Icon = s.icon;
        return (
          <div
            key={s.id}
            className={cn(
              "create-lead-panel overflow-hidden rounded-2xl transition-[border-color,box-shadow,background-color] duration-200",
              expanded ? "bg-surface shadow-xs" : "hover:border-brand/25 hover:bg-surface",
              s.invalid && "border-danger shadow-[0_0_0_1px_var(--danger)]",
            )}
          >
            <h3 className="m-0">
              <button
                id={buttonId}
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => onToggle(s.id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/25"
              >
                <span
                  className={cn(
                    "inline-flex size-9 shrink-0 items-center justify-center rounded-xl border transition-colors",
                    expanded
                      ? "border-brand/25 bg-brand-soft text-brand"
                      : "border-line/70 bg-surface-muted/60 text-ink-secondary",
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold tracking-tight text-ink">{s.title}</span>
                  <span
                    className={cn(
                      "mt-0.5 block truncate text-caption",
                      s.invalid ? "text-danger" : s.summary ? "text-ink-secondary" : "text-ink-muted",
                    )}
                  >
                    {s.invalid ? "Something here needs a fix" : (s.summary ?? s.placeholder)}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0 text-ink-muted transition-transform duration-200 ease-standard motion-reduce:transition-none",
                    expanded && "rotate-180 text-brand",
                  )}
                />
              </button>
            </h3>
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-standard motion-reduce:transition-none",
                expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                inert={!expanded}
                className="min-h-0 overflow-hidden"
              >
                <div className="space-y-4 border-t border-line/60 px-4 py-4">{s.content}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
