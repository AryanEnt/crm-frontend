import type { TimelineEvent } from "@/lib/api/crm";
import { eventLabel, formatDateTime } from "./topics";

export function HistoryTab({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="rounded-control border border-dashed border-line px-3 py-6 text-center text-body text-ink-muted">
        No interactions recorded yet.
      </p>
    );
  }
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span aria-hidden className="absolute -left-[25px] top-1.5 size-2 rounded-full bg-brand ring-4 ring-surface" />
          <p className="text-caption text-ink-muted">
            <time dateTime={e.occurredAt}>{formatDateTime(e.occurredAt)}</time> · {eventLabel(e.eventType)}
            {e.actorName ? ` · ${e.actorName}` : ""}
          </p>
          <p className="mt-0.5 break-words text-body font-semibold text-ink">{e.title}</p>
          {e.body ? (
            <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap break-words text-body text-ink-secondary">{e.body}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
