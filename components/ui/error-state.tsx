import { AlertCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ErrorStateProps = {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  onRetry?: () => void;
  className?: string;
};

/**
 * State what failed and how to recover — never vague, never apologetic.
 */
export function ErrorState({
  title = "Couldn't load this view",
  description = "Check your connection, then try again. If it keeps failing, ask your admin.",
  icon: Icon = AlertCircle,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center border border-danger/25 bg-danger-soft/50 px-6 py-10 text-center",
        "rounded-[var(--radius-lg)]",
        className,
      )}
      role="alert"
    >
      <div className="mb-3 flex size-9 items-center justify-center rounded-[var(--radius-md)] bg-danger-soft text-danger">
        <Icon className="size-4" aria-hidden />
      </div>
      <h3 className="text-section">{title}</h3>
      <p className="mt-1 max-w-sm text-meta">{description}</p>
      {onRetry ? (
        <Button className="mt-4" size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
