import { cn } from "@/lib/utils";

const BASE = "inline-flex h-5 items-center whitespace-nowrap rounded-full px-2 text-caption font-medium tabular-nums";

function formatDay(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Health color lives only here: the one chip that says what happens next on a record. */
export function NextStepChip({ at, className }: { at?: string | null; className?: string }) {
  if (!at) {
    return <span className={cn(BASE, "bg-warning-soft text-warning", className)}>No next step</span>;
  }
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (new Date(at) < startOfToday) {
    return <span className={cn(BASE, "bg-danger-soft text-danger", className)}>Overdue · {formatDay(at)}</span>;
  }
  return <span className={cn(BASE, "bg-surface-muted text-ink-secondary", className)}>Next {formatDay(at)}</span>;
}
