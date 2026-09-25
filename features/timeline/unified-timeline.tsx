"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Timeline } from "@/components/ui/timeline";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { crmApi, type TimelineEvent } from "@/lib/api/crm";

const PAGE_SIZE = 20;

function formatWhen(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString();
}

function eventTone(
  type: string,
): "neutral" | "brand" | "success" | "warning" | "danger" {
  if (type.includes("verified") || type.includes("completed") || type === "customer.created") {
    return "success";
  }
  if (type.includes("rejected") || type.includes("expired")) return "danger";
  if (type.includes("stage") || type.includes("assignment") || type.includes("requested")) {
    return "warning";
  }
  if (
    type === "call" ||
    type === "whatsapp" ||
    type === "email" ||
    type === "meeting" ||
    type.includes("created") ||
    type.includes("uploaded")
  ) {
    return "brand";
  }
  return "neutral";
}

export function UnifiedTimeline({
  customerId,
  dealId,
  leadId,
}: {
  customerId?: string;
  dealId?: string;
  leadId?: string;
}) {
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [offset, setOffset] = React.useState(0);
  const [accumulated, setAccumulated] = React.useState<TimelineEvent[]>([]);

  const typesQuery = useQuery({
    queryKey: ["timeline-types"],
    queryFn: () => crmApi.listTimelineTypes(),
  });

  const params = React.useMemo(() => {
    const p = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (customerId) p.set("customerId", customerId);
    if (dealId) p.set("dealId", dealId);
    if (leadId) p.set("leadId", leadId);
    if (typeFilter !== "all") p.set("type", typeFilter);
    return p;
  }, [customerId, dealId, leadId, typeFilter, offset]);

  const query = useQuery({
    queryKey: ["timeline", params.toString()],
    queryFn: () => crmApi.listTimeline(params),
  });

  React.useEffect(() => {
    setOffset(0);
    setAccumulated([]);
  }, [customerId, dealId, leadId, typeFilter]);

  React.useEffect(() => {
    if (!query.data) return;
    setAccumulated((prev) => {
      if (offset === 0) return query.data.data;
      const seen = new Set(prev.map((e) => e.id));
      return [...prev, ...query.data.data.filter((e) => !seen.has(e.id))];
    });
  }, [query.data, offset]);

  if (query.isLoading && offset === 0) {
    return <LoadingState compact label="Loading timeline…" />;
  }
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;

  const items = accumulated.map((e) => {
    const threadId = typeof e.metadata?.threadId === "string" ? e.metadata.threadId : "";
    return {
      id: e.id,
      title: e.title || e.eventType,
      description: [e.body, e.actorName, e.source !== "crm" ? e.source : null]
        .filter(Boolean)
        .join(" · "),
      timestamp: formatWhen(e.occurredAt),
      tone: eventTone(e.eventType),
      href: e.eventType === "email" && threadId ? `/email?thread=${threadId}` : undefined,
    };
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
          }}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Event type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {(typesQuery.data ?? []).map((t) => (
              <SelectItem key={t.code} value={t.code}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-meta">
          <span className="text-data">{query.data?.total ?? 0}</span> events
        </span>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No timeline events yet"
          description="Calls, emails, and CRM updates linked to this record show up here."
        />
      ) : (
        <Timeline items={items} />
      )}

      {query.data?.hasMore ? (
        <div className="flex justify-center pt-2">
          <Button
            size="sm"
            variant="outline"
            loading={query.isFetching}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
