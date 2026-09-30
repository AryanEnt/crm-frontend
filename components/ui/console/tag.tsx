import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Tag({
  icon: Icon,
  className,
  children,
}: {
  icon?: LucideIcon;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-full items-center gap-1 rounded-sm border border-line bg-surface-sunken px-1.5 text-caption font-medium text-ink-secondary",
        className,
      )}
    >
      {Icon ? <Icon aria-hidden className="size-3 shrink-0 text-ink-muted" /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
