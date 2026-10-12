import { api } from "@/lib/api/client";
import type { TimelineEvent } from "@/lib/api/crm";

export type CallEntityType = "lead" | "customer";

export type CallContact = {
  type: CallEntityType;
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  employer: string;
  stageName?: string | null;
  priority: string;
  ownerName?: string | null;
  updatedAt: string;
  pinned: boolean;
};

export type CallPriority = "low" | "medium" | "high" | "urgent";

export type CallContactParams = {
  q?: string;
  type?: CallEntityType;
  priority?: CallPriority;
  pinned?: boolean;
};

export type CallPerson = {
  type: CallEntityType;
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  employer: string;
  jobTitle: string;
  occupation: string;
  anzscoCode?: string | null;
  anzscoTitle?: string | null;
  qualification: string;
  experienceYears?: number | null;
  skills: string[];
  country: string;
  location: string;
  source: string;
  priority: string;
  status: string;
  pipelineName?: string | null;
  stageName?: string | null;
  ownerUserId?: string | null;
  ownerName?: string | null;
  teamName?: string | null;
  expectedOutcome: string;
  potentialValue?: number | null;
  notes: string;
  lastContactAt?: string | null;
  nextFollowUpAt?: string | null;
  tags: string[];
  createdAt: string;
};

export type CallDeal = {
  id: string;
  title: string;
  status: string;
  stageName?: string | null;
  value?: number | null;
  currency: string;
  expectedCloseAt?: string | null;
  lostReason: string;
};

export type CallUpcoming = {
  id: string;
  title: string;
  kind: string;
  typeName?: string | null;
  status: string;
  dueAt?: string | null;
};

export type CallInteraction = {
  eventType: string;
  title: string;
  body: string;
  occurredAt: string;
  actorName?: string | null;
};

export type CallDocument = { id: string; name: string; docType: string; status: string };

export type CallContext = {
  person: CallPerson;
  deals: CallDeal[];
  upcoming: CallUpcoming[];
  lastInteraction: CallInteraction | null;
  documents: CallDocument[];
};

export type CallNote = {
  id: string;
  leadId?: string | null;
  customerId?: string | null;
  topic: string;
  content: string;
  authorUserId?: string | null;
  authorName?: string | null;
  createdAt: string;
  updatedAt: string;
};

function entityParams(type: CallEntityType, id: string) {
  return new URLSearchParams({ type, id }).toString();
}

export const callsApi = {
  contacts: (params: CallContactParams, signal?: AbortSignal) => {
    const p = new URLSearchParams();
    if (params.q) p.set("q", params.q);
    if (params.type) p.set("type", params.type);
    if (params.priority) p.set("priority", params.priority);
    if (params.pinned) p.set("pinned", "true");
    return api.get<CallContact[]>(`/calls/contacts?${p}`, { signal });
  },
  pin: (type: CallEntityType, id: string) =>
    api.post<{ pinned: boolean }>("/calls/pins", { entityType: type, entityId: id }),
  unpin: (type: CallEntityType, id: string) =>
    api.delete<{ pinned: boolean }>(`/calls/pins/${type}/${encodeURIComponent(id)}`),
  context: (type: CallEntityType, id: string) =>
    api.get<CallContext>(`/calls/context?${entityParams(type, id)}`),
  history: (type: CallEntityType, id: string) =>
    api.get<TimelineEvent[]>(`/calls/history?${entityParams(type, id)}`),
  notes: (type: CallEntityType, id: string) =>
    api.get<CallNote[]>(`/calls/notes?${entityParams(type, id)}`),
  createNote: (body: { entityType: CallEntityType; entityId: string; topic: string; content: string }) =>
    api.post<CallNote>("/calls/notes", body),
  updateNote: (id: string, body: { topic?: string; content?: string }) =>
    api.patch<CallNote>(`/calls/notes/${id}`, body),
  deleteNote: (id: string) => api.delete<{ deleted: boolean }>(`/calls/notes/${id}`),
};
