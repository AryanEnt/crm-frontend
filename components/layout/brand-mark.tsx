import Image from "next/image";
import { cn } from "@/lib/utils";

/** Product mark — the CRM logo asset in /public/brand-logo.jpg. */
export function BrandMark({
  className,
  priority = false,
}: {
  /** @deprecated Letter mark removed; kept so call sites that pass label still type-check. */
  label?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-control bg-[#ececee]",
        className,
      )}
    >
      <Image
        src="/brand-logo.jpg"
        alt=""
        fill
        sizes="80px"
        className="object-contain p-0.5"
        priority={priority}
      />
    </span>
  );
}
