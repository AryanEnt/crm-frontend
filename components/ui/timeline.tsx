import Link from "next/link";
import { cn } from "@/lib/utils";

export type TimelineItem = {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger";
  href?: string;
};

const toneDot: Record<NonNullable<TimelineItem["tone"]>, string> = {
  neutral: "bg-foreground-subtle",
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
};

export function Timeline({
  items,
  className,
}: {
  items: TimelineItem[];
  className?: string;
}) {
  return (
    <ol className={cn("relative space-y-0", className)}>
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
          {index < items.length - 1 ? (
            <span
              className="absolute left-[7px] top-4 h-[calc(100%-8px)] w-px bg-border"
              aria-hidden
            />
          ) : null}
          <span
            className={cn(
              "relative mt-1.5 size-2 shrink-0 rounded-full ring-4 ring-surface",
              toneDot[item.tone ?? "neutral"],
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
              <time className="shrink-0 text-meta text-data">
                {item.timestamp}
              </time>
            </div>
            {item.description ? (
              <p className="mt-0.5 text-meta">{item.description}</p>
            ) : null}
            {item.href ? (
              <Link href={item.href} className="mt-1 inline-block text-xs text-brand hover:underline">
                View email
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
