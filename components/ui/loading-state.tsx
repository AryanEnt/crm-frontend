import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type LoadingStateProps = {
  label?: string;
  className?: string;
  compact?: boolean;
};

export function LoadingState({
  label = "Loading…",
  className,
  compact = false,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 text-foreground-muted",
        compact ? "py-6" : "py-12",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-4 animate-spin text-brand" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-surface-muted", className)}
      aria-hidden
    />
  );
}
