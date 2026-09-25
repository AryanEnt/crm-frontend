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
 * Keep copy concrete: what appears here + what to do next.
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
    <div
      className={cn(
        "flex flex-col items-center justify-center border border-dashed border-border bg-surface px-6 py-10 text-center",
        "rounded-[var(--radius-lg)]",
        className,
      )}
    >
      <div className="mb-3 flex size-9 items-center justify-center rounded-[var(--radius-md)] bg-surface-muted text-foreground-muted">
        <Icon className="size-4" aria-hidden />
      </div>
      <h3 className="text-section">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-meta">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <Button className="mt-4" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
