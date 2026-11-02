import { api } from "@/lib/api/client";

export type EmailIntegrationHealth = {
  configured: boolean;
  oauthConfigured: boolean;
  gmailApiEnabled: boolean;
  imapConfigured?: boolean;
  companyServer?: {
    imapHost: string;
    imapPort: number;
    imapSecure: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
  } | null;
  pubSubConfigured: boolean;
  pushSyncHealthy: boolean;
  connectedAccounts: number;
  needsAttention: number;
  message?: string;
};

export type TeamMailboxPerson = {
  userId: string;
  fullName: string;
  email: string;
  mailbox: EmailAccount | null;
  sentToday: number;
  receivedToday: number;
  canChangeSettings: boolean;
};

export type TeamMailboxesResponse = {
  overview: {
    assigned: number;
    connected: number;
    disconnected: number;
    syncFailures: number;
    sentToday: number;
    receivedToday: number;
    lastSyncAt?: string | null;
  };
  people: TeamMailboxPerson[];
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
  ownerUserId?: string;
  username?: string;
  managerUserId?: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
};

export type ImapConnectBody = {
  ownerUserId?: string;
  provider?: string;
  emailAddress: string;
  username?: string;
  password: string;
  inviteToken?: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
};

export type MailboxStageResult = {
  ok: boolean;
  host: string;
  port: number;
  secure: boolean;
  code?: "auth" | "tls" | "network" | "timeout" | "quota" | "reject" | "unknown";
  message?: string;
};

export type MailboxCheck = {
  requestId: string;
  provider?: string;
  /** "mapping" when an admin mapping chose the server, "dns" when the domain's mail records did, "override" when a TL did. */
  providerSource?: "mapping" | "dns" | "override";
  imap: MailboxStageResult;
  smtp: MailboxStageResult;
};

export type MailServerSettings = {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
};

/** Admin-managed record saying which mail provider hosts a company domain. */
export type DomainProvider = MailServerSettings & {
  id: string;
  domain: string;
  provider: "migadu" | "spacemail" | "imap";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DomainProviderInput = Partial<MailServerSettings> & {
  domain: string;
  provider: DomainProvider["provider"];
  isActive?: boolean;
};

export type DomainProviderResolution = {
  domain: string;
  mapping: {
    provider: DomainProvider["provider"];
    settings: MailServerSettings;
    source: "mapping" | "dns";
  } | null;
};

export type MailboxTestResponse = MailboxCheck & { ok: boolean; inbox: string; sent: string | null };

/** Per-protocol results from a successful test, or from the details of a failed test/connect. */
export function mailboxCheckOf(value: unknown): MailboxCheck | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const candidate = (v.mailboxCheck ?? (v.details as Record<string, unknown> | undefined)?.mailboxCheck ?? v) as
    | Partial<MailboxCheck>
    | undefined;
  if (!candidate?.imap || !candidate?.smtp) return null;
  return {
    requestId: String(candidate.requestId ?? ""),
    provider: candidate.provider,
    providerSource: candidate.providerSource,
    imap: candidate.imap,
    smtp: candidate.smtp,
  };
}

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
  listTeamMailboxes: () => api.get<TeamMailboxesResponse>("/email/team/mailboxes"),
  createInvite: (body: { invitedUserId: string; emailAddress?: string; provider?: string }) =>
    api.post<{ url: string; expiresAt: string }>("/email/invites", body),
  peekInvite: (token: string) =>
    api.get<{ invite: { emailAddress: string; provider: string; expiresAt: string } | null }>(
      `/email/invites/${token}`,
    ),
  listDomainProviders: () => api.get<{ items: DomainProvider[] }>("/email/domain-providers"),
  createDomainProvider: (body: DomainProviderInput) => api.post<DomainProvider>("/email/domain-providers", body),
  updateDomainProvider: (id: string, body: DomainProviderInput) =>
    api.put<DomainProvider>(`/email/domain-providers/${id}`, body),
  deleteDomainProvider: (id: string) => api.delete<{ deleted: boolean }>(`/email/domain-providers/${id}`),
  resolveDomainProvider: (email: string) =>
    api.get<DomainProviderResolution>(`/email/domain-providers/resolve${qs({ email })}`),
  testImap: (body: ImapConnectBody) => api.post<MailboxTestResponse>("/email/imap/test", body),
  connectImap: (body: ImapConnectBody) =>
    api.post<EmailAccount>("/email/imap/connect", body),
  testTeamMailbox: (body: ImapConnectBody) => api.post<MailboxTestResponse>("/email/team/mailboxes/test", body),
  connectTeamMailbox: (body: ImapConnectBody) =>
    api.post<EmailAccount>("/email/team/mailboxes", body),
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
