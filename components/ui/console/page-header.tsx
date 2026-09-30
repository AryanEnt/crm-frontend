import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

export function ConsolePageHeader({
  breadcrumbs,
  title,
  count,
  description,
  actions,
  className,
}: {
  breadcrumbs?: Crumb[];
  title: string;
  /** Rendered as a muted badge next to the title; omit while loading. */
  count?: number;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {breadcrumbs?.length ? (
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1 text-caption text-ink-muted">
              {breadcrumbs.map((crumb, index) => {
                const last = index === breadcrumbs.length - 1;
                return (
                  <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                    {crumb.href && !last ? (
                      <Link href={crumb.href} className="rounded-sm transition-colors duration-150 hover:text-ink">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span aria-current={last ? "page" : undefined}>{crumb.label}</span>
                    )}
                    {last ? null : <ChevronRight aria-hidden className="size-3 text-ink-subtle" />}
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}
        <div className="flex items-center gap-2">
          <h1 className="text-title text-ink">{title}</h1>
          {count !== undefined ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-line bg-surface-sunken px-1.5 text-caption font-medium tabular-nums text-ink-muted">
              {count}
            </span>
          ) : null}
        </div>
        {description ? <p className="mt-1 text-body text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
