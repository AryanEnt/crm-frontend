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

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn’t load this content. Please try again.",
  icon: Icon = AlertCircle,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive-soft/40 px-6 py-10 text-center",
        className,
      )}
      role="alert"
    >
      <div className="mb-3 flex size-9 items-center justify-center rounded-md bg-destructive-soft text-destructive">
        <Icon className="size-4" />
      </div>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-foreground-muted">{description}</p>
      {onRetry ? (
        <Button className="mt-4" size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
