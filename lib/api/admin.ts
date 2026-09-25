import { api } from "@/lib/api/client";

export type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  isActive: boolean;
  teamIds: string[];
  lastLoginAt?: string | null;
  deactivatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminRole = {
  id: string;
  code: string;
  name: string;
  description: string;
  permissions: string[];
};

export type AdminTeamMember = {
  id: string;
  fullName: string;
  email: string;
  roleCode: string;
  roleName: string;
};

export type AdminTeam = {
  id: string;
  name: string;
  description: string;
  teamLeadUserId?: string | null;
  teamLeadName?: string | null;
  isActive: boolean;
  memberIds: string[];
  members?: AdminTeamMember[];
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  actorUserId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string;
  createdAt: string;
};

export type ListResult<T> = {
  items: T[];
  total: number;
};

async function listWithMeta<T>(path: string): Promise<{ data: T[]; total: number }> {
  // apiRequest returns data only; for meta we need a custom call
  const res = await fetch(`/api/proxy${path}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  const envelope = await res.json();
  if (!res.ok || !envelope.success) {
    throw new Error(envelope.error?.message ?? "Request failed");
  }
  return { data: envelope.data ?? [], total: envelope.meta?.total ?? 0 };
}

export const adminApi = {
  listUsers: (params: URLSearchParams) => listWithMeta<AdminUser>(`/users?${params}`),
  createUser: (body: unknown) => api.post<AdminUser>("/users", body),
  updateUser: (id: string, body: unknown) => api.patch<AdminUser>(`/users/${id}`, body),
  setUserStatus: (id: string, isActive: boolean) =>
    api.post<AdminUser>(`/users/${id}/status`, { isActive }),
  bulkUserStatus: (ids: string[], isActive: boolean) =>
    api.post<{ updated: number }>("/users/bulk-status", { ids, isActive }),
  listRoles: () => api.get<AdminRole[]>("/roles"),
  listTeams: (params: URLSearchParams) => listWithMeta<AdminTeam>(`/teams?${params}`),
  createTeam: (body: unknown) => api.post<AdminTeam>("/teams", body),
  updateTeam: (id: string, body: unknown) => api.patch<AdminTeam>(`/teams/${id}`, body),
  setTeamStatus: (id: string, isActive: boolean) =>
    api.post<AdminTeam>(`/teams/${id}/status`, { isActive }),
  listAuditLogs: (params: URLSearchParams) => listWithMeta<AuditLog>(`/audit-logs?${params}`),

  automationsCatalog: () => api.get<AutomationCatalog>("/automations/catalog"),
  listAutomations: (params: URLSearchParams) =>
    listWithMeta<CrmAutomation>(`/automations?${params}`),
  getAutomation: (id: string) => api.get<CrmAutomation>(`/automations/${id}`),
  createAutomation: (body: unknown) => api.post<CrmAutomation>("/automations", body),
  updateAutomation: (id: string, body: unknown) =>
    api.patch<CrmAutomation>(`/automations/${id}`, body),
  deleteAutomation: (id: string) => api.delete<{ deleted: boolean }>(`/automations/${id}`),
  listAutomationRuns: (params: URLSearchParams) =>
    listWithMeta<AutomationRun>(`/automations/runs?${params}`),
  listAutomationJobs: (params: URLSearchParams) =>
    listWithMeta<AutomationJob>(`/automations/jobs?${params}`),
  retryAutomationJob: (id: string) => api.post<AutomationJob>(`/automations/jobs/${id}/retry`, {}),

  listLeadSources: (params?: { activeOnly?: boolean; q?: string }) => {
    const p = new URLSearchParams();
    if (params?.activeOnly) p.set("activeOnly", "true");
    if (params?.q) p.set("q", params.q);
    const qs = p.toString();
    return api.get<LeadSource[]>(`/lead-sources${qs ? `?${qs}` : ""}`);
  },
  createLeadSource: (body: LeadSourceCreateInput) => api.post<LeadSource>("/lead-sources", body),
  updateLeadSource: (id: string, body: LeadSourceUpdateInput) =>
    api.patch<LeadSource>(`/lead-sources/${id}`, body),
  deleteLeadSource: (id: string) => api.delete<{ deleted: boolean }>(`/lead-sources/${id}`),

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
  getCustomField: (id: string) => api.get<CustomFieldDefinition>(`/custom-fields/${id}`),
  createCustomField: (body: CustomFieldCreateInput) =>
    api.post<CustomFieldDefinition>("/custom-fields", body),
  updateCustomField: (id: string, body: CustomFieldUpdateInput) =>
    api.patch<CustomFieldDefinition>(`/custom-fields/${id}`, body),
  deleteCustomField: (id: string) => api.delete<{ deleted: boolean }>(`/custom-fields/${id}`),

  listAdminActivityTypes: () => api.get<AdminActivityType[]>("/admin/activity-types"),
  createAdminActivityType: (body: AdminActivityTypeCreateInput) =>
    api.post<AdminActivityType>("/admin/activity-types", body),
  updateAdminActivityType: (id: string, body: AdminActivityTypeUpdateInput) =>
    api.patch<AdminActivityType>(`/admin/activity-types/${id}`, body),
  deleteAdminActivityType: (id: string) =>
    api.delete<{ deleted: boolean }>(`/admin/activity-types/${id}`),

  listSystemActivity: (params: URLSearchParams) =>
    listWithMeta<SystemActivityEvent>(`/system-activity?${params}`),
  getSystemActivity: (id: string) => api.get<SystemActivityEvent>(`/system-activity/${id}`),

  getOrganizationAnalytics: (params: URLSearchParams) =>
    api.get<OrganizationAnalytics>(`/analytics/organization?${params}`),

  listSettings: () => api.get<OrgSetting[]>("/settings"),
  updateSettings: (settings: Record<string, string>) =>
    api.put<OrgSetting[]>("/settings", { settings }),
};

export type LeadSource = {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  position: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type LeadSourceCreateInput = {
  name: string;
  description?: string;
  isActive?: boolean;
  position?: number;
};

export type LeadSourceUpdateInput = {
  name?: string;
  description?: string;
  isActive?: boolean;
  position?: number;
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
  pipelineId?: string | null;
  pipelineName?: string | null;
  stageId?: string | null;
  stageName?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  options: CustomFieldOption[];
  createdAt: string;
  updatedAt: string;
};

export type CustomFieldOptionInput = {
  label: string;
  value: string;
  position?: number;
};

export type CustomFieldCreateInput = {
  entity: string;
  name: string;
  internalKey: string;
  fieldType: string;
  description?: string;
  helpText?: string;
  isRequired?: boolean;
  isActive?: boolean;
  displayOrder?: number;
  pipelineId?: string;
  stageId?: string;
  options?: CustomFieldOptionInput[];
};

export type CustomFieldUpdateInput = {
  name?: string;
  description?: string;
  helpText?: string;
  isRequired?: boolean;
  isActive?: boolean;
  displayOrder?: number;
  pipelineId?: string;
  stageId?: string;
  options?: CustomFieldOptionInput[];
};

export type AdminActivityType = {
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
  requiresDatetime: boolean;
  requiresDuration: boolean;
  requiresOutcome: boolean;
  requiresNotes: boolean;
};

export type AdminActivityTypeCreateInput = {
  name: string;
  code?: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
  position?: number;
  requiresDatetime?: boolean;
  requiresDuration?: boolean;
  requiresOutcome?: boolean;
  requiresNotes?: boolean;
};

export type AdminActivityTypeUpdateInput = {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
  position?: number;
  requiresDatetime?: boolean;
  requiresDuration?: boolean;
  requiresOutcome?: boolean;
  requiresNotes?: boolean;
};

export type SystemActivityEvent = {
  id: string;
  eventType: string;
  title: string;
  description: string;
  actorUserId?: string | null;
  actorName?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  entityType: string;
  entityId?: string | null;
  entityLabel: string;
  result: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type OrganizationTopMetrics = {
  totalUsers: number;
  activeUsers: number;
  totalTeams: number;
  totalLeads: number;
  totalCustomers: number;
  totalDeals: number;
  activeDeals: number;
  completedActivities: number;
  pipelineValue: number;
};

export type AnalyticsMetricPoint = { key: string; label: string; value: number };

export type OrganizationAnalytics = {
  topMetrics: OrganizationTopMetrics;
  userAdoption: {
    activeUsers: number;
    usersWithActivity: number;
    usersWithNoRecentActivity: number;
    activitiesCreated: number;
    activitiesCompleted: number;
  };
  growth: {
    leads: AnalyticsMetricPoint[];
    customers: AnalyticsMetricPoint[];
    deals: AnalyticsMetricPoint[];
    activities: AnalyticsMetricPoint[];
  };
  pipelineOverview: {
    activePipelineValue: number;
    dealsByPipeline: AnalyticsMetricPoint[];
    dealsByStage: AnalyticsMetricPoint[];
    avgDealValue: number;
  };
  conversionOverview: {
    leads: number;
    qualifiedLeads: number;
    deals: number;
    conversions: number;
    conversionRate: number;
  };
  referralOverview: {
    total: number;
    active: number;
    converted: number;
    pipelineValue: number;
    trend: AnalyticsMetricPoint[];
  };
  from: string;
  to: string;
};

export type OrgSetting = {
  key: string;
  value: string;
  valueType: string;
  updatedBy?: string | null;
  updatedAt: string;
};

export type AutomationCatalogItem = {
  code: string;
  label: string;
  description?: string;
};

export type AutomationCatalog = {
  triggers: AutomationCatalogItem[];
  conditions: AutomationCatalogItem[];
  actions: AutomationCatalogItem[];
  operators: AutomationCatalogItem[];
};

export type AutomationCondition = {
  field: string;
  operator: string;
  value: unknown;
};

export type AutomationAction = {
  type: string;
  params: Record<string, unknown>;
};

export type CrmAutomation = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  triggerType: string;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  createdAt: string;
  updatedAt: string;
};

export type AutomationRun = {
  id: string;
  automationId?: string | null;
  automationName: string;
  jobId?: string | null;
  eventId?: string | null;
  triggerType: string;
  resourceType: string;
  resourceId?: string | null;
  conditions: AutomationCondition[];
  conditionsMatched: boolean;
  actions: AutomationAction[];
  actionResults: Array<{
    type: string;
    status: string;
    detail?: string;
    error?: string;
  }>;
  status: string;
  errorMessage: string;
  startedAt: string;
  finishedAt?: string | null;
};

export type AutomationJob = {
  id: string;
  eventId?: string | null;
  automationId?: string | null;
  triggerType: string;
  resourceType: string;
  resourceId?: string | null;
  status: string;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lastError: string;
  createdAt: string;
};
