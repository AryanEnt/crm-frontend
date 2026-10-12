"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { callsApi, type CallContact, type CallEntityType, type CallNote, type CallPriority } from "@/lib/api/calls";

export type CallSelection = { type: CallEntityType; id: string };

export type ContactFilters = {
  q: string;
  type: CallEntityType | "all";
  priority: CallPriority | "all";
  pinnedOnly: boolean;
};

const CONTACTS_KEY = ["calls", "contacts"] as const;

export const callKeys = {
  contacts: (f: ContactFilters) => [...CONTACTS_KEY, f.q, f.type, f.priority, f.pinnedOnly] as const,
  context: (s: CallSelection) => ["calls", "context", s.type, s.id] as const,
  history: (s: CallSelection) => ["calls", "history", s.type, s.id] as const,
  notes: (s: CallSelection) => ["calls", "notes", s.type, s.id] as const,
};

/** Cached per contact, so switching back to someone is instant. */
const PER_CONTACT_STALE = 60_000;

export function useCallContacts(f: ContactFilters) {
  return useQuery({
    queryKey: callKeys.contacts(f),
    queryFn: ({ signal }) =>
      callsApi.contacts(
        {
          q: f.q,
          type: f.type === "all" ? undefined : f.type,
          priority: f.priority === "all" ? undefined : f.priority,
          pinned: f.pinnedOnly,
        },
        signal,
      ),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Pins are per user; the list flips the icon immediately and re-sorts once the refetch lands. */
export function usePinContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contact, pinned }: { contact: CallContact; pinned: boolean }) =>
      pinned ? callsApi.pin(contact.type, contact.id) : callsApi.unpin(contact.type, contact.id),
    onMutate: async ({ contact, pinned }) => {
      await qc.cancelQueries({ queryKey: CONTACTS_KEY });
      const previous = qc.getQueriesData<CallContact[]>({ queryKey: CONTACTS_KEY });
      qc.setQueriesData<CallContact[]>({ queryKey: CONTACTS_KEY }, (list) =>
        list?.map((c) => (c.type === contact.type && c.id === contact.id ? { ...c, pinned } : c)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CONTACTS_KEY }),
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
