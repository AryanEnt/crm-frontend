"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Compact CRM field control sizing shared by quick-create drawers. */
export const CRM_FIELD_INPUT_CLASS =
  "h-10 rounded-md border-border px-3 text-[13px] shadow-none placeholder:text-foreground-subtle";

/**
 * Uppercase section label — no card chrome.
 * Use whitespace + typography for hierarchy (CRM quick-add rhythm).
 */
export function CrmFormSection({
  title,
  children,
  className,
  divided,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  /** Render a top hairline divider before this section */
  divided?: boolean;
}) {
  return (
    <>
      {divided ? <div className="border-t border-border" aria-hidden /> : null}
      <section className={cn("space-y-2.5", className)}>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground-subtle">
          {title}
        </h3>
        <div className="space-y-2.5">{children}</div>
      </section>
    </>
  );
}
