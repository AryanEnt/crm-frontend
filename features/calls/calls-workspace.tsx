"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/console/button";
import { Skeleton } from "@/components/ui/console/skeleton";
import { useAuth } from "@/features/auth/auth-provider";
import type { CallEntityType } from "@/lib/api/calls";
import { ContactPanel } from "./contact-panel";
import { GuideTab } from "./guide-tab";
import { HistoryTab } from "./history-tab";
import { AddNote, NoteList } from "./notes";
import { PersonCard } from "./person-card";
import { DEFAULT_TOPICS } from "./topics";
import { TopicsTab } from "./topics-tab";
import { useCallWorkspace, type CallSelection } from "./use-call-data";

type Tab = "guide" | "topics" | "notes" | "history";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "guide", label: "Guide" },
  { id: "topics", label: "Topics" },
  { id: "notes", label: "Notes" },
  { id: "history", label: "History" },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseSelection(params: URLSearchParams): CallSelection | null {
  const type = params.get("type");
  const id = params.get("id") ?? "";
  if ((type === "lead" || type === "customer") && UUID.test(id)) return { type, id };
  return null;
}

export function CallsWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selection = parseSelection(new URLSearchParams(params.toString()));

  const select = (type: CallEntityType, id: string) => {
    const next = new URLSearchParams({ type, id });
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  return (
    <div>
      <PageHeader title="Calls" description="Prepare for your next conversation with a lead or customer." />
      <div className="grid gap-4 min-[1000px]:grid-cols-[300px_minmax(0,1fr)]">
        <ContactPanel selection={selection} onSelect={(c) => select(c.type, c.id)} />
        <section aria-live="polite" aria-label="Conversation preparation" className="min-w-0">
          {selection ? (
            <PersonWorkspace key={`${selection.type}-${selection.id}`} selection={selection} />
          ) : (
            <NoSelection />
          )}
        </section>
      </div>
    </div>
  );
}

function NoSelection() {
  return (
    <div className="flex flex-col items-center rounded-card border border-line bg-surface px-6 py-14 text-center">
      <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
        <MessageSquareText className="size-5" aria-hidden />
      </span>
      <h2 className="text-base font-semibold text-ink">Prepare for your next conversation</h2>
      <p className="mt-1 text-body text-ink-secondary">Select a lead or customer to view:</p>
      <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
        {["Context", "Interactions", "Guide", "Topics", "Notes"].map((pill) => (
          <li key={pill} className="rounded-full bg-surface-muted px-2.5 py-1 text-caption font-medium text-ink-secondary">
            {pill}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-card border border-danger-border bg-danger-soft/50 p-4">
      <p className="text-body text-ink">{message}</p>
      <Button size="sm" className="mt-2" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading contact">
      <div className="rounded-card border border-line bg-surface p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3 rounded-card border border-line bg-surface p-5">
        <Skeleton className="h-4 w-60" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

function PersonWorkspace({ selection }: { selection: CallSelection }) {
  const { can } = useAuth();
  const { context, history, notes } = useCallWorkspace(selection);
  const [tab, setTab] = React.useState<Tab>("guide");
  const [activeTopic, setActiveTopic] = React.useState(DEFAULT_TOPICS[0].id);
  const canAdd = can("activities:create");
  const topics = DEFAULT_TOPICS;
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  if (context.isLoading) return <WorkspaceSkeleton />;
  if (context.isError || !context.data) {
    return (
      <ErrorCard
        message="Couldn't load this contact. It may have been reassigned or removed."
        onRetry={() => void context.refetch()}
      />
    );
  }

  const noteList = notes.data ?? [];
  const openTopic = (topicId: string) => {
    setActiveTopic(topicId);
    setTab("topics");
  };

  const onTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    const map: Record<string, number> = {
      ArrowRight: (index + 1) % TABS.length,
      ArrowLeft: (index - 1 + TABS.length) % TABS.length,
      Home: 0,
      End: TABS.length - 1,
    };
    const next = map[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  const notesPanel = notes.isLoading ? (
    <div className="space-y-2">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-12 w-full" />
    </div>
  ) : notes.isError ? (
    <ErrorCard message="Couldn't load notes." onRetry={() => void notes.refetch()} />
  ) : null;

  return (
    <div className="space-y-4">
      <PersonCard person={context.data.person} />

      <section className="rounded-card border border-line bg-surface">
        <div role="tablist" aria-label="Preparation" className="crm-scroll flex gap-1 overflow-x-auto border-b border-line px-2 sm:px-4">
          {TABS.map((t, i) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`calls-tab-${t.id}`}
                aria-selected={active}
                aria-controls={`calls-panel-${t.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => onTabKeyDown(e, i)}
                className={cn(
                  "-mb-px inline-flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-cell font-medium transition-colors duration-150",
                  active ? "border-brand text-ink" : "border-transparent text-ink-secondary hover:text-ink",
                )}
              >
                {t.label}
                {t.id === "notes" && notes.data ? (
                  <span className="rounded-full bg-surface-muted px-1.5 text-caption tabular-nums text-ink-secondary">
                    {noteList.length}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`calls-panel-${tab}`}
          aria-labelledby={`calls-tab-${tab}`}
          tabIndex={0}
          className="p-4 sm:p-5"
        >
          {tab === "guide" ? (
            <GuideTab context={context.data} notes={noteList} topics={topics} onOpenTopic={openTopic} />
          ) : tab === "topics" ? (
            (notesPanel ?? (
              <TopicsTab
                selection={selection}
                context={context.data}
                notes={noteList}
                topics={topics}
                activeTopic={activeTopic}
                onTopicChange={setActiveTopic}
                canAdd={canAdd}
              />
            ))
          ) : tab === "notes" ? (
            (notesPanel ?? (
              <div className="space-y-5">
                {canAdd ? (
                  <div className="rounded-control border border-line bg-surface-muted/40 p-3">
                    <AddNote selection={selection} topics={topics} defaultTopic={activeTopic} />
                  </div>
                ) : null}
                <NoteList
                  notes={noteList}
                  selection={selection}
                  topics={topics}
                  showTopic
                  emptyText="No notes yet."
                />
              </div>
            ))
          ) : history.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-2.5 w-32" />
                  <Skeleton className="h-3.5 w-3/4" />
                </div>
              ))}
            </div>
          ) : history.isError ? (
            <ErrorCard message="Couldn't load the history." onRetry={() => void history.refetch()} />
          ) : (
            <HistoryTab events={history.data ?? []} />
          )}
        </div>
      </section>
    </div>
  );
}
