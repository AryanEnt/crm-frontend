import * as React from "react";
import { CloudOff, RotateCw, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <span
        aria-hidden
        className="mb-4 flex size-10 items-center justify-center rounded-card border border-line bg-surface-sunken text-ink-muted"
      >
        <Icon className="size-5" />
      </span>
      <h3 className="text-heading text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-body text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function ErrorCard({
  title = "Couldn't load data",
  description = "Something went wrong while contacting the server. Check your connection and try again.",
  onRetry,
  retrying = false,
  className,
}: {
  title?: string;
  description?: React.ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <span
        aria-hidden
        className="mb-4 flex size-10 items-center justify-center rounded-card border border-danger-border bg-danger-soft text-danger"
      >
        <CloudOff className="size-5" />
      </span>
      <h3 className="text-heading text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-body text-ink-muted">{description}</p>
      {onRetry ? (
        <Button className="mt-5" loading={retrying} onClick={onRetry}>
          {retrying ? null : <RotateCw aria-hidden />}
          Retry
        </Button>
      ) : null}
    </div>
  );
}
