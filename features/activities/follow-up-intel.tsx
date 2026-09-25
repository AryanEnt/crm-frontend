"use client";

import { useQuery } from "@tanstack/react-query";
import { crmApi } from "@/lib/api/crm";
import { formatDateInTimezone, formatTimeInTimezone } from "@/lib/timezone";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils";

export function FollowUpIntelPanel({
  leadId,
  customerId,
  dealId,
}: {
  leadId?: string;
  customerId?: string;
  dealId?: string;
}) {
  const { user } = useAuth();
  const timezone = user?.timezone || "UTC";
  const params = new URLSearchParams();
  if (leadId) params.set("leadId", leadId);
  if (customerId) params.set("customerId", customerId);
  if (dealId) params.set("dealId", dealId);

  const query = useQuery({
    queryKey: ["follow-up", params.toString()],
    queryFn: () => crmApi.followUpIntel(params),
    enabled: !!(leadId || customerId || dealId),
  });

  if (query.isLoading) {
    return (
      <section className="rounded-lg border border-border bg-surface p-4">
        <h3 className="mb-3 text-section">Follow-up</h3>
        <p className="text-meta">Loading…</p>
      </section>
    );
  }

  if (!query.data) return null;
  const d = query.data;
  const hasOverdue = (d.overdueCount ?? 0) > 0;
  const nextTone = !d.nextActivityAt
    ? "text-health-warn"
    : new Date(d.nextActivityAt).getTime() < Date.now()
      ? "text-health-bad"
      : "text-foreground";

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-3 text-section">Follow-up</h3>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <WhenMetric
          className="col-span-2"
          label="Last activity"
          at={d.lastActivityAt}
          timezone={timezone}
        />
        <WhenMetric
          className="col-span-2"
          label="Next activity"
          at={d.nextActivityAt}
          timezone={timezone}
          valueClass={nextTone}
        />
        <Metric
          label="Days since contact"
          value={d.daysSinceContact != null ? String(d.daysSinceContact) : "—"}
          tabular
        />
        <Metric
          label="Overdue"
          value={
            d.overdueDurationHours != null
              ? formatDurationHours(d.overdueDurationHours)
              : "—"
          }
          tabular
          valueClass={d.overdueDurationHours != null ? "text-health-bad" : undefined}
        />
        <Metric
          label="Days in stage"
          value={d.daysInStage != null ? String(d.daysInStage) : "—"}
          tabular
        />
        <Metric
          label="Open items"
          value={`${d.upcomingCount} upcoming`}
          hint={hasOverdue ? `${d.overdueCount} overdue` : "0 overdue"}
          hintClass={hasOverdue ? "text-health-bad" : "text-foreground-muted"}
        />
      </dl>
    </section>
  );
}

function formatDurationHours(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

function WhenMetric({
  label,
  at,
  timezone,
  valueClass,
  className,
}: {
  label: string;
  at?: string | null;
  timezone: string;
  valueClass?: string;
  className?: string;
}) {
  const date = formatDateInTimezone(at, timezone);
  const time = at ? formatTimeInTimezone(at, timezone) : null;
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-label text-foreground-subtle">{label}</dt>
      <dd className={cn("mt-0.5 text-sm text-foreground", valueClass)}>
        {date === "—" ? (
          "—"
        ) : (
          <>
            <span>{date}</span>
            {time ? <span className="text-foreground-muted"> · {time}</span> : null}
          </>
        )}
      </dd>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  hintClass,
  valueClass,
  tabular,
}: {
  label: string;
  value: string;
  hint?: string;
  hintClass?: string;
  valueClass?: string;
  tabular?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-label text-foreground-subtle">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-sm text-foreground",
          tabular && "text-data tabular-nums",
          valueClass,
        )}
      >
        {value}
      </dd>
      {hint ? (
        <p className={cn("mt-0.5 text-meta", hintClass)}>{hint}</p>
      ) : null}
    </div>
  );
}
