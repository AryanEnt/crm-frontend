"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/console/button";
import { Select } from "@/components/ui/console/select";
import { Textarea } from "@/components/ui/console/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/features/auth/auth-provider";
import type { CallNote } from "@/lib/api/calls";
import { formatDateTime, topicLabel, type TopicDefinition } from "./topics";
import { useNoteMutations, type CallSelection } from "./use-call-data";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function NoteForm({
  topics,
  defaultTopic,
  initial,
  saving,
  submitLabel = "Save note",
  onSubmit,
  onCancel,
}: {
  topics: TopicDefinition[];
  defaultTopic: string;
  initial?: { topic: string; content: string };
  saving: boolean;
  submitLabel?: string;
  /** Resolve true when saved so the form can clear; on failure the text stays. */
  onSubmit: (topic: string, content: string) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const id = React.useId();
  const [topic, setTopic] = React.useState(initial?.topic ?? defaultTopic);
  const [content, setContent] = React.useState(initial?.content ?? "");
  const [syncedTopic, setSyncedTopic] = React.useState(defaultTopic);
  if (!initial && defaultTopic !== syncedTopic) {
    setSyncedTopic(defaultTopic);
    setTopic(defaultTopic);
  }
  const empty = content.trim() === "";

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (empty || saving) return;
        void onSubmit(topic, content).then((ok) => {
          if (ok && !initial) setContent("");
        });
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor={`${id}-topic`} className="text-cell font-medium text-ink">
          Topic
        </label>
        <Select id={`${id}-topic`} uiSize="lg" value={topic} onChange={(e) => setTopic(e.target.value)}>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${id}-content`} className="text-cell font-medium text-ink">
          Note
        </label>
        <Textarea
          id={`${id}-content`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What did you learn? What was agreed?"
          maxLength={5000}
          rows={3}
        />
      </div>
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        ) : empty ? null : (
          <Button onClick={() => setContent("")} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={empty || saving}>
          {saving ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Add-note form wired to the API, with toasts. */
export function AddNote({
  selection,
  topics,
  defaultTopic,
  onCancel,
  onSaved,
}: {
  selection: CallSelection;
  topics: TopicDefinition[];
  defaultTopic: string;
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const { create } = useNoteMutations(selection);
  return (
    <NoteForm
      topics={topics}
      defaultTopic={defaultTopic}
      saving={create.isPending}
      onCancel={onCancel}
      onSubmit={async (topic, content) => {
        try {
          await create.mutateAsync({ topic, content });
          toast.success("Note saved");
          onSaved?.();
          return true;
        } catch (err) {
          toast.error(errorMessage(err, "Couldn't save the note. Your text is still here; try again."));
          return false;
        }
      }}
    />
  );
}

export function NoteList({
  notes,
  selection,
  topics,
  showTopic,
  emptyText,
}: {
  notes: CallNote[];
  selection: CallSelection;
  topics: TopicDefinition[];
  showTopic: boolean;
  emptyText: string;
}) {
  if (notes.length === 0) return <p className="text-body text-ink-muted">{emptyText}</p>;
  return (
    <ul className="divide-y divide-line">
      {notes.map((note) => (
        <NoteItem key={note.id} note={note} selection={selection} topics={topics} showTopic={showTopic} />
      ))}
    </ul>
  );
}

function NoteItem({
  note,
  selection,
  topics,
  showTopic,
}: {
  note: CallNote;
  selection: CallSelection;
  topics: TopicDefinition[];
  showTopic: boolean;
}) {
  const { user, can } = useAuth();
  const { update, remove } = useNoteMutations(selection);
  const [editing, setEditing] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const mine = !!user && note.authorUserId === user.id && can("activities:edit");
  const edited = new Date(note.updatedAt).getTime() - new Date(note.createdAt).getTime() > 1000;

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-muted">
        {showTopic ? (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand-ink">
            {topicLabel(note.topic, topics)}
          </span>
        ) : null}
        <span className="font-medium text-ink-secondary">{note.authorName ?? "Former user"}</span>
        <span aria-hidden>·</span>
        <time dateTime={note.createdAt}>{formatDateTime(note.createdAt)}</time>
        {edited ? <span>(edited)</span> : null}
        {mine && !editing ? (
          <span className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
              Delete
            </Button>
          </span>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-2">
          <NoteForm
            topics={topics}
            defaultTopic={note.topic}
            initial={{ topic: note.topic, content: note.content }}
            saving={update.isPending}
            submitLabel="Save changes"
            onCancel={() => setEditing(false)}
            onSubmit={async (topic, content) => {
              try {
                await update.mutateAsync({ id: note.id, topic, content });
                toast.success("Note updated");
                setEditing(false);
                return true;
              } catch (err) {
                toast.error(errorMessage(err, "Couldn't update the note. Try again."));
                return false;
              }
            }}
          />
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap break-words text-body text-ink">{note.content}</p>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete this note?"
        description="It will also be removed from this person's timeline."
        confirmLabel="Delete note"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(note.id);
            toast.success("Note deleted");
            setConfirming(false);
          } catch (err) {
            toast.error(errorMessage(err, "Couldn't delete the note. Try again."));
          }
        }}
      />
    </li>
  );
}
