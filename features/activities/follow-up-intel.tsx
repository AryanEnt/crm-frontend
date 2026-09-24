"use client";

import { useQuery } from "@tanstack/react-query";
import { crmApi } from "@/lib/api/crm";
import { formatInTimezone } from "@/lib/timezone";
import { useAuth } from "@/features/auth/auth-provider";

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

  if (!query.data) return null;
  const d = query.data;

  return (
    <section className="rounded-lg border border-border bg-surface p-3">
      <h3 className="mb-2 text-sm font-semibold">Follow-up</h3>
      <dl className="grid gap-1.5 text-xs sm:grid-cols-2">
        <Row label="Last activity" value={formatInTimezone(d.lastActivityAt, timezone)} />
        <Row label="Next activity" value={formatInTimezone(d.nextActivityAt, timezone)} />
        <Row
          label="Days since contact"
          value={d.daysSinceContact != null ? String(d.daysSinceContact) : "—"}
        />
        <Row
          label="Overdue duration"
          value={
            d.overdueDurationHours != null ? `${d.overdueDurationHours}h` : "—"
          }
        />
        <Row
          label="Days in stage"
          value={d.daysInStage != null ? String(d.daysInStage) : "—"}
        />
        <Row
          label="Open items"
          value={`${d.upcomingCount} upcoming · ${d.overdueCount} overdue`}
        />
      </dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-36 shrink-0 text-foreground-subtle">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
