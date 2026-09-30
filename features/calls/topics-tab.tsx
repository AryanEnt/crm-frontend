"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { CallContext, CallNote } from "@/lib/api/calls";
import { AddNote, NoteList } from "./notes";
import type { TopicDefinition } from "./topics";
import type { CallSelection } from "./use-call-data";

export function TopicsTab({
  selection,
  context,
  notes,
  topics,
  activeTopic,
  onTopicChange,
  canAdd,
}: {
  selection: CallSelection;
  context: CallContext;
  notes: CallNote[];
  topics: TopicDefinition[];
  activeTopic: string;
  onTopicChange: (topicId: string) => void;
  canAdd: boolean;
}) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const topic = topics.find((t) => t.id === activeTopic) ?? topics[0];
  const known = topic.known(context);
  const topicNotes = notes.filter((n) => n.topic === topic.id);
  const [adding, setAdding] = React.useState(false);
  const [addingFor, setAddingFor] = React.useState(topic.id);
  if (addingFor !== topic.id) {
    setAddingFor(topic.id);
    setAdding(false);
  }

  const hasInfo = (t: TopicDefinition) => t.known(context).length > 0 || notes.some((n) => n.topic === t.id);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const i = topics.findIndex((t) => t.id === topic.id);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? topics.length - 1
          : event.key === "ArrowDown" || event.key === "ArrowRight"
            ? (i + 1) % topics.length
            : (i - 1 + topics.length) % topics.length;
    onTopicChange(topics[next].id);
    listRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
  };

  return (
    <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
      <div
        ref={listRef}
        role="tablist"
        aria-label="Topics"
        onKeyDown={onKeyDown}
        className="crm-scroll -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0"
      >
        {topics.map((t) => {
          const active = t.id === topic.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`topic-tab-${t.id}`}
              aria-selected={active}
              aria-controls="topic-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => onTopicChange(t.id)}
              className={cn(
                "flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-control px-2.5 text-left text-cell transition-colors duration-150",
                active ? "bg-brand-soft font-medium text-brand-ink" : "text-ink-secondary hover:bg-surface-muted hover:text-ink",
              )}
            >
              <span className="flex-1">{t.label}</span>
              {hasInfo(t) ? (
                <span className="size-1.5 rounded-full bg-success" role="img" aria-label="Has information" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        id="topic-panel"
        role="tabpanel"
        aria-labelledby={`topic-tab-${topic.id}`}
        className="min-w-0 space-y-5 rounded-card border border-line p-4"
      >
        <h3 className="text-base font-semibold text-ink">{topic.label}</h3>

        <section className="space-y-2">
          <h4 className="text-overline text-ink-muted">Known information</h4>
          {known.length ? (
            <blockquote className="space-y-1 border-l-2 border-brand bg-surface-muted/60 py-2 pl-3 pr-2">
              {known.map((f, i) => (
                <p key={`${f.label}-${i}`} className="break-words text-body text-ink">
                  <span className="text-ink-secondary">{f.label}:</span> {f.value}
                </p>
              ))}
            </blockquote>
          ) : (
            <p className="rounded-control border border-dashed border-line px-3 py-3 text-body text-ink-muted">
              Nothing recorded for this topic yet.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h4 className="text-overline text-ink-muted">Suggested questions</h4>
          <ul className="space-y-1.5">
            {topic.questions.map((q) => (
              <li key={q} className="flex gap-2.5 text-body text-ink">
                <span aria-hidden className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-brand" />
                {q}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-overline text-ink-muted">Notes ({topicNotes.length})</h4>
            {canAdd && !adding ? (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="rounded-sm text-cell font-medium text-brand-ink hover:underline"
              >
                Add note
              </button>
            ) : null}
          </div>
          {adding ? (
            <div className="rounded-control border border-line bg-surface-muted/40 p-3">
              <AddNote
                selection={selection}
                topics={topics}
                defaultTopic={topic.id}
                onCancel={() => setAdding(false)}
                onSaved={() => setAdding(false)}
              />
            </div>
          ) : null}
          <NoteList
            notes={topicNotes}
            selection={selection}
            topics={topics}
            showTopic={false}
            emptyText="No notes on this topic yet."
          />
        </section>
      </div>
    </div>
  );
}
