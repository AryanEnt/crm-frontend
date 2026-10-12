import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Line drawing of stacked cards; stroke follows the brand token. */
function CardsIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 88"
      fill="none"
      aria-hidden
      className={cn("h-20 w-28 text-brand", className)}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="22" y="14" width="76" height="22" rx="7" className="stroke-current opacity-35" />
      <rect x="14" y="30" width="92" height="26" rx="8" className="stroke-current opacity-60" fill="currentColor" fillOpacity="0.04" />
      <rect x="8" y="48" width="104" height="30" rx="9" className="stroke-current" fill="currentColor" fillOpacity="0.06" />
      <circle cx="24" cy="63" r="6" className="stroke-current" />
      <path d="M36 59h34M36 67h22" className="stroke-current" />
      <path d="M90 63h10" className="stroke-current opacity-60" />
    </svg>
  );
}

export function PipelineEmpty({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-column border border-dashed border-line bg-surface px-6 py-14 text-center",
        className,
      )}
    >
      <CardsIllustration />
      <h2 className="mt-4 text-[0.9375rem] font-semibold text-ink">{title}</h2>
      <p className="mt-1 max-w-sm text-[0.8125rem] text-ink-muted">{description}</p>
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
