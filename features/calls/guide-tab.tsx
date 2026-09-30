import type { CallContext, CallNote } from "@/lib/api/calls";
import { eventLabel, formatDate, GUIDE_CLARIFY, GUIDE_QUESTIONS, type TopicDefinition } from "./topics";

type Tile = { label: string; value: string };

function contextTiles(ctx: CallContext, notes: CallNote[], topics: TopicDefinition[]): Tile[] {
  const tiles: Tile[] = [];
  const firstKnown = (topicId: string) => topics.find((t) => t.id === topicId)?.known(ctx)[0];
  const latestNote = (ids: string[]) => notes.find((n) => ids.includes(n.topic));

  const requirement = latestNote(["requirements"])?.content ?? firstKnown("requirements")?.value;
  if (requirement) tiles.push({ label: "Known requirement", value: requirement });

  const timeline = latestNote(["timeline"])?.content ?? firstKnown("timeline")?.value;
  if (timeline) tiles.push({ label: "Timeline", value: timeline });

  const concern = latestNote(["concerns", "objections"])?.content ?? firstKnown("objections")?.value;
  if (concern) tiles.push({ label: "Previous concern", value: concern });

  const last = ctx.lastInteraction;
  if (last) {
    tiles.push({
      label: "Last interaction",
      value: `${eventLabel(last.eventType)} · ${formatDate(last.occurredAt)}${last.title ? ` — ${last.title}` : ""}`,
    });
  }
  return tiles;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-cell font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

export function GuideTab({
  context,
  notes,
  topics,
  onOpenTopic,
}: {
  context: CallContext;
  notes: CallNote[];
  topics: TopicDefinition[];
  onOpenTopic: (topicId: string) => void;
}) {
  const tiles = contextTiles(context, notes, topics);
  const firstName = context.person.fullName.split(/\s+/)[0] || context.person.fullName;

  return (
    <div className="space-y-6">
      <Section title="Important context">
        {tiles.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {tiles.map((tile) => (
              <li key={tile.label} className="min-w-0 rounded-control bg-brand-soft/60 px-3 py-2.5">
                <p className="text-overline text-brand-ink">{tile.label}</p>
                <p className="mt-0.5 line-clamp-3 break-words text-body text-ink">{tile.value}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-control border border-dashed border-line px-3 py-4 text-body text-ink-muted">
            No context recorded yet. Notes you save during this conversation will appear here next time.
          </p>
        )}
      </Section>

      <Section title="Opening">
        <p className="text-body text-ink-secondary">
          Greet {firstName}, confirm it&apos;s still a good time to talk, and recap briefly what you discussed last time
          before moving on.
        </p>
      </Section>

      <Section title="Suggested questions">
        <ul className="space-y-1.5">
          {GUIDE_QUESTIONS.map((q) => (
            <li key={q} className="flex gap-2.5 text-body text-ink">
              <span aria-hidden className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-brand" />
              {q}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Things to clarify">
        <ul className="flex flex-wrap gap-1.5">
          {GUIDE_CLARIFY.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                onClick={() => onOpenTopic(item.topicId)}
                className="h-7 rounded-full border border-line bg-surface px-3 text-caption font-medium text-ink-secondary transition-colors duration-150 hover:border-brand hover:text-brand-ink"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
