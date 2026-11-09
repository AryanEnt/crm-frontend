"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Soft panel for always-visible create-lead blocks. */
export function FormSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const headingId = React.useId();
  return (
    <section
      aria-labelledby={id ?? headingId}
      className={cn("create-lead-panel rounded-2xl p-4 sm:p-5", className)}
    >
      <header className="mb-4 space-y-0.5">
        <h3 id={id ?? headingId} className="text-sm font-semibold tracking-tight text-ink">
          {title}
        </h3>
        {description ? <p className="text-caption text-ink-muted">{description}</p> : null}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function FormSectionDivider({ className }: { className?: string }) {
  return <div role="separator" className={cn("hidden", className)} />;
}
