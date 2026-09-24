import { api } from "@/lib/api/client";
import { ApiError, type ApiEnvelope } from "@/types/api";

export type ReferralCatalogItem = {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  isConverted?: boolean;
};

export type ReferralMeta = {
  referrerTypes: ReferralCatalogItem[];
  relationships: ReferralCatalogItem[];
  statuses: ReferralCatalogItem[];
};

export type Referral = {
  id: string;
  leadId?: string | null;
  customerId?: string | null;
  referrerTypeId: string;
  referrerTypeCode: string;
  referrerTypeName: string;
  referrerUserId?: string | null;
  referrerUserName?: string | null;
  referrerCustomerId?: string | null;
  referrerCustomerName?: string | null;
  referrerPartnerId?: string | null;
  referrerPartnerName?: string | null;
  referrerName: string;
  referrerDisplayName: string;
  relationshipId?: string | null;
  relationshipCode?: string | null;
  relationshipName?: string | null;
  referralDate: string;
  referralSource: string;
  notes: string;
  statusId: string;
  statusCode: string;
  statusName: string;
  isConverted: boolean;
  referralCode?: string | null;
  createdByUserId?: string | null;
  referredName?: string | null;
  ownerUserId?: string | null;
  ownerName?: string | null;
  teamId?: string | null;
  pipelineId?: string | null;
  pipelineName?: string | null;
  stageId?: string | null;
  stageName?: string | null;
  potentialValue?: number | null;
  subjectKind?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReferralInput = {
  referrerTypeCode: string;
  referrerUserId?: string | null;
  referrerCustomerId?: string | null;
  referrerPartnerId?: string | null;
  referrerName?: string;
  relationshipCode?: string | null;
  referralDate?: string;
  referralSource?: string;
  notes?: string;
  referralCode?: string | null;
  statusCode?: string;
};

export type ReferralSummary = {
  totalReferrals: number;
  activeReferrals: number;
  convertedReferrals: number;
  unconvertedReferrals: number;
  referralPipelineValue: number;
};

export type ReferrerProfile = {
  referrerKey: string;
  referrerTypeCode: string;
  referrerTypeName: string;
  referrerUserId?: string | null;
  referrerCustomerId?: string | null;
  referrerPartnerId?: string | null;
  referrerDisplayName: string;
  totalReferrals: number;
  activeReferrals: number;
  convertedReferrals: number;
  history: Referral[];
};

export type ReferralPartner = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company: string;
  notes: string;
  isActive: boolean;
};

async function listWithMeta<T>(path: string): Promise<{ data: T[]; total: number }> {
  const res = await fetch(`/api/proxy${path}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  const envelope = (await res.json()) as ApiEnvelope<T[]>;
  if (!res.ok || !envelope.success) {
    throw new ApiError(envelope.error?.message ?? "Request failed", {
      status: res.status,
      code: envelope.error?.code ?? "request_failed",
    });
  }
  return { data: envelope.data ?? [], total: (envelope.meta?.total as number) ?? 0 };
}

export const referralsApi = {
  meta: () => api.get<ReferralMeta>("/referrals/meta"),
  summary: (params: URLSearchParams) =>
    api.get<ReferralSummary>(`/referrals/summary?${params}`),
  list: (params: URLSearchParams) => listWithMeta<Referral>(`/referrals?${params}`),
  get: (id: string) => api.get<Referral>(`/referrals/${id}`),
  bySubject: (params: { leadId?: string; customerId?: string }) => {
    const p = new URLSearchParams();
    if (params.leadId) p.set("leadId", params.leadId);
    if (params.customerId) p.set("customerId", params.customerId);
    return api.get<Referral | null>(`/referrals/subject?${p}`);
  },
  create: (body: ReferralInput & { leadId?: string; customerId?: string }) =>
    api.post<Referral>("/referrals", body),
  update: (id: string, body: Partial<ReferralInput>) =>
    api.patch<Referral>(`/referrals/${id}`, body),
  referrerProfile: (type: "user" | "customer" | "partner", id: string) =>
    api.get<ReferrerProfile>(`/referrers/${type}/${id}`),
  listPartners: (q = "") =>
    api.get<ReferralPartner[]>(`/referral-partners?q=${encodeURIComponent(q)}`),
  createPartner: (body: { name: string; email?: string; phone?: string; company?: string }) =>
    api.post<ReferralPartner>("/referral-partners", body),
};

export function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}
