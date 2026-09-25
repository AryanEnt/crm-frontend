import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/skeleton";

export type LoadingStateProps = {
  label?: string;
  className?: string;
  compact?: boolean;
  /** Prefer content-shaped skeleton for list/table modules */
  variant?: "spinner" | "table";
};

export function LoadingState({
  label = "Loading…",
  className,
  compact = false,
  variant = "spinner",
}: LoadingStateProps) {
  if (variant === "table") {
    return <TableSkeleton className={className} />;
  }

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
      <Loader2 className="size-4 animate-spin text-brand" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export { Skeleton } from "@/components/ui/skeleton";
