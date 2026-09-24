import { api } from "@/lib/api/client";

export type EmailIntegrationHealth = {
  configured: boolean;
  oauthConfigured: boolean;
  gmailApiEnabled: boolean;
  pubSubConfigured: boolean;
  pushSyncHealthy: boolean;
  connectedAccounts: number;
  needsAttention: number;
  message?: string;
};

export type EmailAccount = {
  id: string;
  provider: string;
  emailAddress: string;
  displayName: string;
  avatarUrl: string;
  connectionStatus: "connected" | "syncing" | "needs_reauth" | "error" | "disconnected" | string;
  sendingEnabled: boolean;
  receivingEnabled: boolean;
  lastSyncAt?: string | null;
  lastSyncError?: string;
  createdAt: string;
};

export type EmailAccountsResponse = {
  accounts: EmailAccount[];
  integration: EmailIntegrationHealth;
};

export type EmailThread = {
  id: string;
  accountId: string;
  ownerUserId: string;
  ownerName?: string;
  providerThreadId: string;
  leadId?: string | null;
  leadName?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  dealId?: string | null;
  participants: string[];
  subject: string;
  lastMessageAt?: string | null;
  lastMessagePreview: string;
  messageCount: number;
  unreadCount: number;
  starred: boolean;
  archived: boolean;
  matchStatus: "matched" | "unmatched" | "needs_association" | string;
  hasAttachments: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EmailAttachment = {
  id: string;
  messageId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export type EmailMessage = {
  id: string;
  threadId: string;
  accountId: string;
  ownerUserId: string;
  providerMessageId: string;
  providerThreadId: string;
  direction: "outbound" | "inbound" | string;
  from: string;
  fromName: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  snippet: string;
  sentAt?: string | null;
  receivedAt?: string | null;
  scheduledAt?: string | null;
  status: string;
  hasAttachments: boolean;
  inReplyTo?: string | null;
  attachments?: EmailAttachment[];
  createdAt: string;
};

export type EmailFolderCounts = {
  inbox: number;
  sent: number;
  drafts: number;
  starred: number;
  unmatched: number;
  scheduled: number;
  archived: number;
};

export type EmailThreadList = {
  threads: EmailThread[];
  total: number;
  limit: number;
  offset: number;
  counts: EmailFolderCounts;
};

export type EmailThreadDetail = {
  thread: EmailThread;
  messages: EmailMessage[];
};

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  category: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ComposePayload = {
  accountId?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  leadId?: string;
  customerId?: string;
  dealId?: string;
  inReplyTo?: string;
  threadId?: string;
  scheduledAt?: string;
  send?: boolean;
};

function qs(params: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const emailApi = {
  health: () => api.get<EmailIntegrationHealth>("/email/health"),
  listAccounts: () => api.get<EmailAccountsResponse>("/email/accounts"),
  connectGoogle: (redirectTo?: string) =>
    api.post<{ url: string }>("/email/google/connect", { redirectTo }),
  disconnect: (id: string) =>
    api.post<{ disconnected: boolean }>(`/email/accounts/${id}/disconnect`, {}),
  sync: (accountId: string) =>
    api.post<{ synced: boolean }>(`/email/sync/${accountId}`, {}),
  listThreads: (params: Record<string, string | undefined>) =>
    api.get<EmailThreadList>(`/email/threads${qs(params)}`),
  getThread: (id: string) => api.get<EmailThreadDetail>(`/email/threads/${id}`),
  patchThread: (id: string, body: { starred?: boolean; archived?: boolean }) =>
    api.patch<EmailThread>(`/email/threads/${id}`, body),
  associate: (id: string, body: { leadId?: string; customerId?: string; dealId?: string }) =>
    api.post<EmailThread>(`/email/threads/${id}/associate`, body),
  compose: (body: ComposePayload) => api.post<EmailMessage>("/email/messages", body),
  patchDraft: (
    id: string,
    body: {
      to?: string[];
      cc?: string[];
      bcc?: string[];
      subject?: string;
      bodyHtml?: string;
      bodyText?: string;
    },
  ) => api.patch<EmailMessage>(`/email/messages/${id}/draft`, body),
  send: (id: string) => api.post<EmailMessage>(`/email/messages/${id}/send`, {}),
  preview: (body: {
    subject: string;
    bodyHtml: string;
    bodyText?: string;
    leadId?: string;
    customerId?: string;
  }) =>
    api.post<{
      subject: string;
      bodyHtml: string;
      bodyText: string;
      unresolved: string[];
      canSend: boolean;
    }>("/email/preview", body),
  listTemplates: () => api.get<EmailTemplate[]>("/email/templates"),
  createTemplate: (body: unknown) => api.post<EmailTemplate>("/email/templates", body),
  updateTemplate: (id: string, body: unknown) =>
    api.patch<EmailTemplate>(`/email/templates/${id}`, body),
  deleteTemplate: (id: string) => api.delete<{ deleted: boolean }>(`/email/templates/${id}`),
};
