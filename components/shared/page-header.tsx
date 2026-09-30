import * as React from "react";
import { cn } from "@/lib/utils";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/shared/breadcrumbs";

export type PageHeaderProps = {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  /** Larger title for reference screens. */
  display?: boolean;
  className?: string;
};

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  display,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("mb-4 space-y-2", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div
        className={cn(
          "flex flex-col gap-2 sm:flex-row sm:justify-between",
          display ? "sm:items-end" : "sm:items-start",
        )}
      >
        <div className="min-w-0">
          <h1 className={display ? "text-display" : "text-page-title"}>{title}</h1>
          {description ? (
            <p className={cn("max-w-2xl", display ? "mt-1 text-body text-ink-muted" : "mt-0.5 text-meta")}>
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <PageActions>{actions}</PageActions> : null}
      </div>
    </header>
  );
}

export function PageActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 flex-wrap items-center gap-2", className)}>{children}</div>
  );
}
