import { cn } from "@/lib/utils";

export function BrandMark({ label = "A", className }: { label?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-control bg-brand text-caption font-bold tracking-tight text-primary-foreground shadow-[inset_0_1px_0_0_rgb(255_255_255/0.16)]",
        className,
      )}
    >
      {label}
    </span>
  );
}
