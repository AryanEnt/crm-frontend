import { type LucideIcon, Phone, Mail, Calendar, CheckSquare, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";

export type ActivityKind = "call" | "email" | "meeting" | "task" | "note";

export type ActivityItemProps = {
  kind: ActivityKind;
  title: string;
  subtitle?: string;
  actor?: string;
  time: string;
  status?: string;
  className?: string;
};

const kindIcon: Record<ActivityKind, LucideIcon> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  task: CheckSquare,
  note: MessageSquare,
};

export function ActivityItem({
  kind,
  title,
  subtitle,
  actor,
  time,
  status,
  className,
}: ActivityItemProps) {
  const Icon = kindIcon[kind];
  const initials = actor
    ?.split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md px-2 py-2 hover:bg-surface-muted/80",
        className,
      )}
    >
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-muted text-foreground-muted">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          <time className="shrink-0 text-[11px] text-foreground-subtle">{time}</time>
        </div>
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs text-foreground-muted">{subtitle}</p>
        ) : null}
        <div className="mt-1.5 flex items-center gap-2">
          {actor ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground-muted">
              <Avatar size="sm">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              {actor}
            </span>
          ) : null}
          {status ? <StatusBadge tone="brand">{status}</StatusBadge> : null}
        </div>
      </div>
    </div>
  );
}
