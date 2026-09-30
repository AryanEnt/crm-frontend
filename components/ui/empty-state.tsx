import { type LucideIcon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

/**
 * Invitation to act — not a blank “No data” wall.
 * Keep copy concrete and human: what appears here + the one thing to do next.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div aria-hidden className="mb-4 flex flex-col items-center gap-1.5">
        <span className="flex size-11 items-center justify-center rounded-card bg-brand-soft text-brand">
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <span className="flex w-8 gap-0.5 opacity-60">
          <span className="h-1 flex-[3] rounded-[2px] bg-stage-1" />
          <span className="h-1 flex-[2] rounded-[2px] bg-stage-2" />
          <span className="h-1 flex-1 rounded-[2px] bg-stage-won" />
        </span>
      </div>
      <h3 className="text-display-sm">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-body text-ink-muted">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button className="mt-5" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
