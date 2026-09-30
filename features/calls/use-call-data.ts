"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { callsApi, type CallEntityType, type CallNote } from "@/lib/api/calls";

export type CallSelection = { type: CallEntityType; id: string };

export const callKeys = {
  contacts: (q: string, type: CallEntityType | "all") => ["calls", "contacts", q, type] as const,
  context: (s: CallSelection) => ["calls", "context", s.type, s.id] as const,
  history: (s: CallSelection) => ["calls", "history", s.type, s.id] as const,
  notes: (s: CallSelection) => ["calls", "notes", s.type, s.id] as const,
};

/** Cached per contact, so switching back to someone is instant. */
const PER_CONTACT_STALE = 60_000;

export function useCallContacts(q: string, type: CallEntityType | "all") {
  return useQuery({
    queryKey: callKeys.contacts(q, type),
    queryFn: ({ signal }) => callsApi.contacts({ q, type: type === "all" ? undefined : type }, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Context, history and notes load in parallel for the selected person. */
export function useCallWorkspace(selection: CallSelection | null) {
  const enabled = selection !== null;
  const key = selection ?? { type: "lead" as const, id: "" };
  const context = useQuery({
    queryKey: callKeys.context(key),
    queryFn: () => callsApi.context(key.type, key.id),
    enabled,
    staleTime: PER_CONTACT_STALE,
  });
  const history = useQuery({
    queryKey: callKeys.history(key),
    queryFn: () => callsApi.history(key.type, key.id),
    enabled,
    staleTime: PER_CONTACT_STALE,
  });
  const notes = useQuery({
    queryKey: callKeys.notes(key),
    queryFn: () => callsApi.notes(key.type, key.id),
    enabled,
    staleTime: PER_CONTACT_STALE,
  });
  return { context, history, notes };
}

export function useNoteMutations(selection: CallSelection) {
  const qc = useQueryClient();
  const notesKey = callKeys.notes(selection);

  // Notes are mirrored into the timeline; refresh the history and any open profile timeline.
  const refreshTimelines = () => {
    void qc.invalidateQueries({ queryKey: callKeys.history(selection) });
    void qc.invalidateQueries({ queryKey: callKeys.context(selection) });
    void qc.invalidateQueries({ queryKey: ["timeline"] });
  };

  const create = useMutation({
    mutationFn: (input: { topic: string; content: string }) =>
      callsApi.createNote({ entityType: selection.type, entityId: selection.id, ...input }),
    onSuccess: (note) => {
      qc.setQueryData<CallNote[]>(notesKey, (prev) => [note, ...(prev ?? [])]);
      refreshTimelines();
    },
  });

  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: string; topic: string; content: string }) => callsApi.updateNote(id, input),
    onSuccess: (note) => {
      qc.setQueryData<CallNote[]>(notesKey, (prev) => (prev ?? []).map((n) => (n.id === note.id ? note : n)));
      refreshTimelines();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => callsApi.deleteNote(id),
    onSuccess: (_data, id) => {
      qc.setQueryData<CallNote[]>(notesKey, (prev) => (prev ?? []).filter((n) => n.id !== id));
      refreshTimelines();
    },
  });

  return { create, update, remove };
}
