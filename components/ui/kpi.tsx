"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/lib/use-count-up";

const defaultFormat = (n: number) => Math.round(n).toLocaleString();

/**
 * Flat KPI: label, a large tabular numeral that counts up, and a hint.
 * No box — KPIs sit on the page and are separated by hairlines by the parent.
 * With `href`, the whole KPI links to the list or page behind the number.
 */
export function Kpi({
  label,
  value,
  format = defaultFormat,
  hint,
  size = "md",
  href,
  className,
}: {
  label: string;
  value: number | null | undefined;
  format?: (n: number) => string;
  hint?: ReactNode;
  size?: "md" | "xl";
  href?: string;
  className?: string;
}) {
  const known = value != null && Number.isFinite(value);
  const shown = useCountUp(known ? value : 0);

  const body = (
    <>
      <p className="flex items-center gap-1 text-label">
        {label}
        {href ? (
          <ArrowUpRight
            aria-hidden
            className="size-3.5 text-ink-subtle opacity-0 transition-[opacity,translate] duration-150 ease-standard group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0"
          />
        ) : null}
      </p>
      <p className={cn("mt-1 truncate", size === "xl" ? "text-numeral-xl" : "text-numeral")}>
        {known ? (
          <>
            <span aria-hidden>{format(shown)}</span>
            <span className="sr-only">{format(value)}</span>
          </>
        ) : (
          "—"
        )}
      </p>
      {hint ? <div className="mt-1 text-meta">{hint}</div> : null}
    </>
  );

  return (
    <div className={cn("min-w-0", className)}>
      {href ? (
        <Link
          href={href}
          className="group -mx-2.5 -my-2 block rounded-lg px-2.5 py-2 transition-colors duration-150 ease-standard hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}
