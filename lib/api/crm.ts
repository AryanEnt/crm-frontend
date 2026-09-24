import { api } from "@/lib/api/client";
import { ApiError, type ApiEnvelope } from "@/types/api";

export type AnzscoOccupation = {
  id: string;
  code: string;
  title: string;
  occupationGroup: string;
  skillLevel: number;
};

export type PipelineStage = {
  id: string;
  pipelineId: string;
  name: string;
  position: number;
  probability: number;
  visualAccent: string;
  requiredFields: string[];
  requiredActivities: string[];
  requiredDocuments: string[];
  slaHours?: number | null;
  isWon: boolean;
  isLost: boolean;
  isActive: boolean;
};

export type Pipeline = {
  id: string;
  name: string;
  description: string;
  kind: string;
  isDefault: boolean;
  isActive: boolean;
  stages: PipelineStage[];
  createdAt?: string;
  updatedAt?: string;
};

export type Deal = {
  id: string;
  title: string;
  customerId: string;
  customerName: string;
  ownerUserId?: string | null;
  ownerName?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  pipelineId?: string | null;
  pipelineName?: string | null;
  stageId?: string | null;
  stageName?: string | null;
  stageAccent?: string | null;
  value?: number | null;
  currency: string;
  probability?: number | null;
  expectedCloseAt?: string | null;
  source: string;
  priority: string;
  status: string;
  notes: string;
  fieldValues?: Record<string, unknown>;
  lastActivityAt?: string | null;
  nextActivityAt?: string | null;
  stageEnteredAt: string;
  ageDays: number;
  daysInStage: number;
  attention: "" | "no_recent_activity" | "attention_needed" | "over_sla" | "no_next_activity" | string;
  lostReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type DealBoard = {
  pipeline: Pipeline;
  columns: Array<{ stage: PipelineStage; deals: Deal[] }>;
};

export type DealDetail = {
  deal: Deal;
  customer: {
    id: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
  };
  transitions: Array<{
    id: string;
    fromStageName?: string | null;
    toStageName: string;
    actorName?: string | null;
    exitedAt: string;
    durationSeconds?: number | null;
  }>;
  activities: Array<{
    id: string;
    kind: string;
    subject: string;
    body: string;
    status: string;
    dueAt?: string | null;
    actorName?: string | null;
    createdAt: string;
  }>;
  documents: Array<{
    id: string;
    name: string;
    category: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
  }>;
  pipeline?: Pipeline | null;
};

export type StageMoveError = {
  missingFields?: string[];
  missingActivities?: string[];
  missingDocuments?: string[];
  stageId?: string;
  stageName?: string;
};

export type Lead = {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  country: string;
  nationality: string;
  location: string;
  ownerUserId?: string | null;
  ownerName?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  source: string;
  priority: string;
  tags: string[];
  anzscoId?: string | null;
  anzscoCode?: string | null;
  anzscoTitle?: string | null;
  pipelineId?: string | null;
  pipelineName?: string | null;
  stageId?: string | null;
  stageName?: string | null;
  notes: string;
  occupation: string;
  jobTitle: string;
  employer: string;
  experienceYears?: number | null;
  qualification: string;
  skills: string[];
  potentialValue?: number | null;
  expectedOutcome: string;
  lastActivityAt?: string | null;
  nextActivityAt?: string | null;
  status: string;
  convertedCustomerId?: string | null;
  ageDays: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DuplicateMatch = {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  entity: "lead" | "customer" | string;
  reason: string;
};

export type Customer = {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  country: string;
  nationality: string;
  location: string;
  ownerUserId?: string | null;
  ownerName?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  source: string;
  priority: string;
  tags: string[];
  anzscoId?: string | null;
  anzscoCode?: string | null;
  anzscoTitle?: string | null;
  occupation: string;
  jobTitle: string;
  employer: string;
  experienceYears?: number | null;
  qualification: string;
  skills: string[];
  pipelineId?: string | null;
  pipelineName?: string | null;
  stageId?: string | null;
  stageName?: string | null;
  potentialValue?: number | null;
  expectedOutcome: string;
  lastContactedAt?: string | null;
  nextFollowUpAt?: string | null;
  notes: string;
  convertedFromLeadId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerProfile = {
  customer: Customer;
  deals: Array<{
    id: string;
    title: string;
    value?: number | null;
    currency: string;
    status: string;
    stageName?: string | null;
    pipelineName?: string | null;
    ownerName?: string | null;
    createdAt: string;
  }>;
  activities: Array<{
    id: string;
    kind: string;
    subject: string;
    body: string;
    status: string;
    dueAt?: string | null;
    actorName?: string | null;
    createdAt: string;
  }>;
  documents: Array<{
    id: string;
    name: string;
    type?: string;
    category?: string;
    status?: string;
    mimeType?: string;
    sizeBytes?: number;
    uploadedByName?: string | null;
    verifiedByName?: string | null;
    requestedDate?: string | null;
    uploadedDate?: string | null;
    expiryDate?: string | null;
    createdAt: string;
  }>;
  referral?: import("@/lib/api/referrals").Referral | null;
};

async function listWithMeta<T>(path: string): Promise<{
  data: T[];
  total: number;
  limit?: number;
  offset?: number;
  hasMore?: boolean;
}> {
  const res = await fetch(`/api/proxy${path}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  const envelope = (await res.json()) as ApiEnvelope<T[]> & {
    meta?: { total?: number; limit?: number; offset?: number; hasMore?: boolean };
  };
  if (!res.ok || !envelope.success) {
    throw new ApiError(envelope.error?.message ?? "Request failed", {
      status: res.status,
      code: envelope.error?.code ?? "request_failed",
    });
  }
  return {
    data: envelope.data ?? [],
    total: envelope.meta?.total ?? 0,
    limit: envelope.meta?.limit,
    offset: envelope.meta?.offset,
    hasMore: envelope.meta?.hasMore,
  };
}

export class DuplicateReviewError extends Error {
  duplicates: DuplicateMatch[];
  constructor(message: string, duplicates: DuplicateMatch[]) {
    super(message);
    this.name = "DuplicateReviewError";
    this.duplicates = duplicates;
  }
}

async function mutateWithDuplicateCheck<T>(
  method: "POST" | "PATCH",
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`/api/proxy${path}`, {
    method,
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const envelope = (await res.json()) as ApiEnvelope<
    T | { duplicates?: DuplicateMatch[]; needsReview?: boolean; lead?: Lead }
  >;

  if (res.status === 409) {
    const data = envelope.data as { duplicates?: DuplicateMatch[] } | undefined;
    throw new DuplicateReviewError(
      envelope.error?.message ?? "Potential duplicates found",
      data?.duplicates ?? [],
    );
  }

  if (!res.ok || !envelope.success) {
    throw new ApiError(envelope.error?.message ?? "Request failed", {
      status: res.status,
      code: envelope.error?.code ?? "request_failed",
    });
  }
  return envelope.data as T;
}

export const crmApi = {
  searchAnzsco: (q: string) =>
    api.get<AnzscoOccupation[]>(`/anzsco?q=${encodeURIComponent(q)}&limit=20`),
  listPipelines: (kind?: string, includeInactive = false) =>
    api.get<Pipeline[]>(
      `/pipelines?${new URLSearchParams({
        ...(kind ? { kind } : {}),
        ...(includeInactive ? { includeInactive: "true" } : {}),
      })}`,
    ),
  getPipeline: (id: string) => api.get<Pipeline>(`/pipelines/${id}`),
  createPipeline: (body: unknown) => api.post<Pipeline>("/pipelines", body),
  updatePipeline: (id: string, body: unknown) => api.patch<Pipeline>(`/pipelines/${id}`, body),
  createStage: (pipelineId: string, body: unknown) =>
    api.post<PipelineStage>(`/pipelines/${pipelineId}/stages`, body),
  updateStage: (stageId: string, body: unknown) =>
    api.patch<PipelineStage>(`/pipeline-stages/${stageId}`, body),
  reorderStages: (pipelineId: string, stageIds: string[]) =>
    api.post<Pipeline>(`/pipelines/${pipelineId}/stages/reorder`, { stageIds }),

  listLeads: (params: URLSearchParams) => listWithMeta<Lead>(`/leads?${params}`),
  getLead: (id: string) => api.get<Lead>(`/leads/${id}`),
  createLead: (body: unknown) => mutateWithDuplicateCheck<Lead>("POST", "/leads", body),
  updateLead: (id: string, body: unknown) =>
    mutateWithDuplicateCheck<Lead>("PATCH", `/leads/${id}`, body),
  bulkArchiveLeads: (ids: string[], archive: boolean) =>
    api.post<{ updated: number }>("/leads/bulk-archive", { ids, archive }),
  bulkAssignLeads: (ids: string[], ownerUserId?: string | null, teamId?: string | null) =>
    api.post<{ updated: number }>("/leads/bulk-assign", { ids, ownerUserId, teamId }),
  bulkStageLeads: (ids: string[], pipelineId: string, stageId: string) =>
    api.post<{ updated: number }>("/leads/bulk-stage", { ids, pipelineId, stageId }),
  convertLead: (id: string) => api.post<Customer>(`/leads/${id}/convert`, {}),

  listCustomers: (params: URLSearchParams) => listWithMeta<Customer>(`/customers?${params}`),
  getCustomerProfile: (id: string) => api.get<CustomerProfile>(`/customers/${id}/profile`),
  createCustomer: (body: unknown) =>
    mutateWithDuplicateCheck<Customer>("POST", "/customers", body),
  updateCustomer: (id: string, body: unknown) =>
    mutateWithDuplicateCheck<Customer>("PATCH", `/customers/${id}`, body),

  listDeals: (params: URLSearchParams) => listWithMeta<Deal>(`/deals?${params}`),
  getDealBoard: (pipelineId: string) =>
    api.get<DealBoard>(`/deals/board?pipelineId=${encodeURIComponent(pipelineId)}`),
  getDeal: (id: string) => api.get<DealDetail>(`/deals/${id}`),
  createDeal: (body: unknown) => api.post<Deal>("/deals", body),
  updateDeal: (id: string, body: unknown) => api.patch<Deal>(`/deals/${id}`, body),
  moveDeal: (
    id: string,
    body: { stageId: string; pipelineId?: string; force?: boolean; lostReason?: string },
  ) => api.post<Deal>(`/deals/${id}/move`, body),
  addDealDocument: (id: string, body: { name: string; category: string }) =>
    api.post<DealDetail>(`/deals/${id}/documents`, body),

  listActivityTypes: () => api.get<ActivityType[]>("/activity-types"),

  listLeadSources: (params?: { activeOnly?: boolean; q?: string }) => {
    const p = new URLSearchParams();
    if (params?.activeOnly) p.set("activeOnly", "true");
    if (params?.q) p.set("q", params.q);
    const qs = p.toString();
    return api.get<LeadSource[]>(`/lead-sources${qs ? `?${qs}` : ""}`);
  },

  listCustomFields: (params?: {
    entity?: string;
    fieldType?: string;
    activeOnly?: boolean;
    q?: string;
  }) => {
    const p = new URLSearchParams();
    if (params?.entity) p.set("entity", params.entity);
    if (params?.fieldType) p.set("fieldType", params.fieldType);
    if (params?.activeOnly) p.set("activeOnly", "true");
    if (params?.q) p.set("q", params.q);
    const qs = p.toString();
    return api.get<CustomFieldDefinition[]>(`/custom-fields${qs ? `?${qs}` : ""}`);
  },
  getCustomFieldValues: (entity: string, recordId: string) =>
    api.get<Record<string, unknown>>(`/custom-fields/values/${entity}/${recordId}`),
  setCustomFieldValues: (entity: string, recordId: string, values: Record<string, unknown>) =>
    api.put<{ saved: boolean }>(`/custom-fields/values/${entity}/${recordId}`, { values }),

  getSettingsMap: async () => {
    try {
      const items = await api.get<Array<{ key: string; value: string }>>("/settings");
      const map: Record<string, string> = {};
      for (const it of items) map[it.key] = it.value;
      return map;
    } catch {
      return api.get<Record<string, string>>("/settings/defaults");
    }
  },
  getCrmDefaults: () => api.get<Record<string, string>>("/settings/defaults"),
  listActivities: (params: URLSearchParams) => listWithMeta<Activity>(`/activities?${params}`),
  calendarActivities: (params: URLSearchParams) =>
    listWithMeta<Activity>(`/activities/calendar?${params}`),
  getActivity: (id: string) => api.get<ActivityDetail>(`/activities/${id}`),
  createActivity: (body: unknown) => api.post<Activity>("/activities", body),
  updateActivity: (id: string, body: unknown) => api.patch<Activity>(`/activities/${id}`, body),
  followUpIntel: (params: URLSearchParams) =>
    api.get<FollowUpIntel>(`/activities/follow-up?${params}`),
  getTimezone: () => api.get<{ timezone: string }>("/me/timezone"),
  setTimezone: (timezone: string) => api.patch<{ timezone: string }>("/me/timezone", { timezone }),

  listDocuments: (params: URLSearchParams) => listWithMeta<CrmDocument>(`/documents?${params}`),
  getDocument: (id: string) => api.get<CrmDocument>(`/documents/${id}`),
  requestDocument: (body: unknown) => api.post<CrmDocument>("/documents/request", body),
  updateDocument: (id: string, body: unknown) => api.patch<CrmDocument>(`/documents/${id}`, body),
  verifyDocument: (id: string) => api.post<CrmDocument>(`/documents/${id}/verify`, {}),
  rejectDocument: (id: string, reason: string) =>
    api.post<CrmDocument>(`/documents/${id}/reject`, { reason }),
  deleteDocument: (id: string) => api.delete<{ deleted: boolean }>(`/documents/${id}`),
  uploadDocument: async (form: FormData, documentId?: string) => {
    const path = documentId
      ? `/api/proxy/documents/${documentId}/upload`
      : `/api/proxy/documents/upload`;
    const res = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      body: form,
    });
    const envelope = (await res.json()) as ApiEnvelope<CrmDocument>;
    if (!res.ok || !envelope.success) {
      throw new ApiError(envelope.error?.message ?? "Upload failed", {
        status: res.status,
        code: envelope.error?.code ?? "request_failed",
      });
    }
    return envelope.data as CrmDocument;
  },
  downloadDocumentUrl: (id: string) => `/api/proxy/documents/${id}/download`,

  listTimeline: (params: URLSearchParams) => listWithMeta<TimelineEvent>(`/timeline?${params}`),
  listTimelineTypes: () =>
    api.get<Array<{ code: string; label: string }>>("/timeline/types"),
  writeTimelineEvent: (body: unknown) => api.post<TimelineEvent>("/timeline/events", body),

  analyticsFunnel: (params: URLSearchParams) =>
    api.get<AnalyticsFunnel>(`/analytics/funnel?${params}`),
  analyticsSummary: (params: URLSearchParams) =>
    api.get<AnalyticsSummary>(`/analytics/summary?${params}`),
  analyticsLeads: (params: URLSearchParams) =>
    api.get<LeadAnalyticsModule>(`/analytics/leads?${params}`),
  analyticsPipeline: (params: URLSearchParams) =>
    api.get<PipelineAnalyticsModule>(`/analytics/pipeline?${params}`),
  analyticsActivities: (params: URLSearchParams) =>
    api.get<ActivityAnalyticsModule>(`/analytics/activities?${params}`),
  analyticsConversions: (params: URLSearchParams) =>
    api.get<ConversionAnalyticsModule>(`/analytics/conversions?${params}`),
  analyticsTeams: (params: URLSearchParams) =>
    api.get<TeamAnalyticsModule>(`/analytics/teams?${params}`),
  analyticsSources: (params: URLSearchParams) =>
    api.get<SourceAnalyticsModule>(`/analytics/sources?${params}`),

  listTargetMetrics: () =>
    api.get<Array<{ code: string; label: string }>>("/targets/metrics"),
  listTargets: (params: URLSearchParams) => listWithMeta<CrmTarget>(`/targets?${params}`),
  listTargetProgress: (params: URLSearchParams) =>
    listWithMeta<TargetProgress>(`/targets/progress?${params}`),
  getTarget: (id: string) => api.get<CrmTarget>(`/targets/${id}`),
  getTargetProgress: (id: string) => api.get<TargetProgress>(`/targets/${id}/progress`),
  createTarget: (body: unknown) => api.post<CrmTarget>("/targets", body),
  updateTarget: (id: string, body: unknown) => api.patch<CrmTarget>(`/targets/${id}`, body),
  deleteTarget: (id: string) => api.delete<{ deleted: boolean }>(`/targets/${id}`),

  forecastMethodology: () => api.get<ForecastMethodologyInfo>("/forecasts/methodology"),
  pipelineForecast: (params: URLSearchParams) =>
    api.get<PipelineForecast>(`/forecasts/pipeline?${params}`),

  predictionsCatalog: () => api.get<PredictionsCatalog>("/predictions/catalog"),
  scoreLead: (id: string) => api.post<PredictionResult>(`/predictions/leads/${id}/score`, {}),
  leadScoreHistory: (id: string, limit = 20) =>
    api.get<LeadScoreHistoryItem[]>(`/predictions/leads/${id}/score-history?limit=${limit}`),
  leadInsights: (id: string) => api.get<LeadInsightsBundle>(`/predictions/leads/${id}/insights`),
  dealInsights: (id: string) => api.get<DealInsightsBundle>(`/predictions/deals/${id}/insights`),
  workloadForecast: (params: URLSearchParams) =>
    api.get<PredictionResult>(`/predictions/workload?${params}`),
  pipelineRisk: (params: URLSearchParams) =>
    api.get<PredictionResult>(`/predictions/pipeline-risk?${params}`),

  listCommunicationAccounts: (provider?: string) =>
    api.get<CommunicationAccount[]>(
      `/communications/accounts${provider ? `?provider=${encodeURIComponent(provider)}` : ""}`,
    ),
  createCommunicationAccount: (body: unknown) =>
    api.post<CommunicationAccount>("/communications/accounts", body),
  listWhatsAppMessages: (params: URLSearchParams) =>
    listWithMeta<WhatsAppMessage>(`/communications/whatsapp/messages?${params}`),
  sendWhatsApp: (body: unknown) => api.post<WhatsAppMessage>("/communications/whatsapp/send", body),
  listTwilioCalls: (params: URLSearchParams) =>
    listWithMeta<TwilioCall>(`/communications/twilio/calls?${params}`),
  placeTwilioCall: (body: unknown) => api.post<TwilioCall>("/communications/twilio/calls", body),
};

export type CrmDocument = {
  id: string;
  name: string;
  type: string;
  category: string;
  status: string;
  mimeType: string;
  sizeBytes: number;
  fileKey: string;
  storageProvider: string;
  notes: string;
  rejectedReason: string;
  leadId?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  dealId?: string | null;
  dealTitle?: string | null;
  uploadedBy?: string | null;
  uploadedByName?: string | null;
  verifiedBy?: string | null;
  verifiedByName?: string | null;
  requestedDate?: string | null;
  uploadedDate?: string | null;
  expiryDate?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TimelineEvent = {
  id: string;
  eventType: string;
  title: string;
  body: string;
  occurredAt: string;
  actorUserId?: string | null;
  actorName?: string | null;
  source: string;
  externalId: string;
  externalProvider: string;
  leadId?: string | null;
  customerId?: string | null;
  dealId?: string | null;
  activityId?: string | null;
  documentId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type LeadSource = {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  position: number;
  usageCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CustomFieldOption = {
  id: string;
  label: string;
  value: string;
  position: number;
  isActive: boolean;
};

export type CustomFieldDefinition = {
  id: string;
  entity: string;
  name: string;
  internalKey: string;
  fieldType: string;
  description: string;
  helpText: string;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
  options: CustomFieldOption[];
  createdAt?: string;
  updatedAt?: string;
};

export type ActivityType = {
  id: string;
  code: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  isSystem: boolean;
  isActive: boolean;
  allowsExternal: boolean;
  position: number;
  requiresDatetime?: boolean;
  requiresDuration?: boolean;
  requiresOutcome?: boolean;
  requiresNotes?: boolean;
};

export type Activity = {
  id: string;
  title: string;
  kind: string;
  typeId?: string | null;
  typeName?: string | null;
  typeColor?: string | null;
  status: string;
  displayStatus: string;
  priority: string;
  notes: string;
  outcome: string;
  ownerUserId?: string | null;
  ownerName?: string | null;
  createdByUserId?: string | null;
  createdByName?: string | null;
  completedByUserId?: string | null;
  completedByName?: string | null;
  leadId?: string | null;
  leadName?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  dealId?: string | null;
  dealTitle?: string | null;
  pipelineId?: string | null;
  pipelineName?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
  externalProvider: string;
  externalId: string;
  externalThreadId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ActivityDetail = {
  activity: Activity;
  context: {
    customerId?: string | null;
    customerName?: string | null;
    dealId?: string | null;
    dealTitle?: string | null;
    leadId?: string | null;
    leadName?: string | null;
    timelineHref: string;
  };
};

export type FollowUpIntel = {
  lastActivityAt?: string | null;
  nextActivityAt?: string | null;
  daysSinceContact?: number | null;
  overdueDurationHours?: number | null;
  daysInStage?: number | null;
  stageEnteredAt?: string | null;
  overdueCount: number;
  upcomingCount: number;
};

export type AnalyticsMetricPoint = { key: string; label: string; value: number };

export type AnalyticsFunnelStage = {
  stageId: string;
  stageName: string;
  position: number;
  isWon: boolean;
  isLost: boolean;
  entered: number;
  left: number;
  currentlyInStage: number;
  conversionRate: number;
  dropOffRate: number;
  avgTimeInStageSeconds?: number | null;
  totalPipelineValue: number;
  averageDealValue: number;
  enteredValue: number;
};

export type AnalyticsFunnel = {
  pipelineId: string;
  pipelineName: string;
  pipelineKind: string;
  from: string;
  to: string;
  stages: AnalyticsFunnelStage[];
  totals: {
    entered: number;
    won: number;
    lost: number;
    open: number;
    totalPipelineValue: number;
    averageDealValue: number;
    overallConversionRate: number;
  };
};

export type AnalyticsSummary = {
  leadVolume: number;
  qualifiedLeads: number;
  deals: number;
  submissions: number;
  positiveOutcomes: number;
  conversions: number;
  conversionRate: number;
  averageResponseTimeSeconds?: number | null;
  averageStageDurationSeconds?: number | null;
  activities: number;
  pipelineValue: number;
  from: string;
  to: string;
};

export type LeadAnalyticsModule = {
  leadVolume: number;
  qualifiedLeads: number;
  convertedLeads: number;
  conversionRate: number;
  averageResponseTimeSeconds?: number | null;
  bySource: AnalyticsMetricPoint[];
  volumeByDay: AnalyticsMetricPoint[];
  question: string;
};

export type PipelineAnalyticsModule = {
  deals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  pipelineValue: number;
  averageDealValue: number;
  averageStageDurationSeconds?: number | null;
  openValueByStage: AnalyticsMetricPoint[];
  question: string;
};

export type ActivityAnalyticsModule = {
  activities: number;
  completed: number;
  overdue: number;
  byType: AnalyticsMetricPoint[];
  byDay: AnalyticsMetricPoint[];
  averagePerDeal: number;
  question: string;
};

export type ConversionAnalyticsModule = {
  leadToCustomerRate: number;
  dealWinRate: number;
  leadsCreated: number;
  leadsConverted: number;
  dealsCreated: number;
  dealsWon: number;
  dealsLost: number;
  positiveOutcomes: number;
  submissions: number;
  conversionFunnel: AnalyticsMetricPoint[];
  question: string;
};

export type TeamAnalyticsRow = {
  entityId: string;
  entityName: string;
  entityType: string;
  leadVolume: number;
  deals: number;
  wonDeals: number;
  activities: number;
  pipelineValue: number;
  conversionRate: number;
  averageStageDurationSeconds?: number | null;
};

export type TeamAnalyticsModule = {
  groupBy: string;
  sortBy: string;
  rows: TeamAnalyticsRow[];
  question: string;
};

export type SourceAnalyticsModule = {
  sources: Array<{
    source: string;
    leads: number;
    customers: number;
    deals: number;
    wonDeals: number;
    pipelineValue: number;
    conversionRate: number;
  }>;
  question: string;
};

export type CrmTarget = {
  id: string;
  name: string;
  metric: string;
  periodType: "monthly" | "quarterly" | string;
  periodStart: string;
  periodEnd: string;
  scopeType: "organization" | "team" | "user" | string;
  teamId?: string | null;
  teamName?: string | null;
  userId?: string | null;
  userName?: string | null;
  pipelineId?: string | null;
  pipelineName?: string | null;
  targetValue: number;
  notes: string;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TargetProgress = {
  target: CrmTarget;
  actual: number;
  remaining: number;
  progressPct?: number | null;
  progressLabel: string;
  daysRemaining: number;
  periodElapsedPct?: number | null;
  asOf: string;
};

export type PipelineForecast = {
  available: boolean;
  message?: string;
  disclaimer: string;
  scenarios?: {
    conservative: number;
    expected: number;
    higherCase: number;
  } | null;
  openDealCount: number;
  openPipelineValue: number;
  transparency: {
    period: { from: string; to: string };
    pipelineId: string;
    pipelineName: string;
    sampleSize: number;
    historicalDataRange: { from: string; to: string };
    inputs: Record<string, unknown>;
    methodology: {
      code: string;
      name: string;
      description: string;
      version: string;
    };
  };
};

export type ForecastMethodologyInfo = {
  disclaimer: string;
  minClosedSample: number;
  insufficientMessage: string;
  methods: Array<{
    code: string;
    name: string;
    description: string;
    version: string;
  }>;
};

export type PredictionSignal = {
  code: string;
  label: string;
  impact: number;
  polarity: string;
  detail?: string;
};

export type PredictionExplanation = {
  summary: string;
  positiveSignals: PredictionSignal[];
  negativeSignals: PredictionSignal[];
  neutralNotes?: string[];
};

export type PredictionResult = {
  available: boolean;
  message?: string;
  disclaimer: string;
  insightType: string;
  entityType: string;
  entityId: string;
  score?: number | null;
  label: string;
  strategyCode: string;
  strategyVersion: string;
  features: Record<string, unknown>;
  explanation: PredictionExplanation;
  payload?: Record<string, unknown>;
  computedAt: string;
  insufficientHistoricalData: boolean;
};

export type LeadScoreHistoryItem = {
  id: string;
  score: number;
  strategyCode: string;
  strategyVersion: string;
  positiveSignals: PredictionSignal[];
  negativeSignals: PredictionSignal[];
  explanation: PredictionExplanation;
  insufficientHistoricalData: boolean;
  computedAt: string;
  disclaimer: string;
};

export type LeadInsightsBundle = {
  disclaimer: string;
  leadScore: PredictionResult;
  insights: PredictionResult[];
};

export type DealInsightsBundle = {
  disclaimer: string;
  insights: PredictionResult[];
};

export type PredictionsCatalog = {
  disclaimer: string;
  insufficientHistoricalData: string;
  minHistoricalSample: number;
  architecture: string;
  strategies: Array<{ code: string; version: string; insightType: string }>;
};

export type CommunicationAccount = {
  id: string;
  provider: "meta_whatsapp" | "twilio_voice" | string;
  name: string;
  displayIdentifier: string;
  externalAccountId: string;
  isActive: boolean;
  ownerUserId?: string | null;
  teamId?: string | null;
  allowRecordings: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WhatsAppMessage = {
  id: string;
  accountId: string;
  direction: string;
  status: string;
  providerMessageId: string;
  conversationKey: string;
  fromNumber: string;
  toNumber: string;
  body: string;
  mediaUrl?: string;
  mediaMime?: string;
  mediaFilename?: string;
  customerId?: string | null;
  dealId?: string | null;
  leadId?: string | null;
  occurredAt: string;
  createdAt: string;
};

export type TwilioCall = {
  id: string;
  accountId: string;
  direction: string;
  status: string;
  providerCallSid: string;
  fromNumber: string;
  toNumber: string;
  durationSeconds?: number | null;
  recordingSid?: string;
  recordingUrl?: string;
  customerId?: string | null;
  dealId?: string | null;
  leadId?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt: string;
};

