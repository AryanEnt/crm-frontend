import type { InAppNotification } from "@/lib/api/crm";

export const SLA_TYPE = "lead_sla_exceeded";

export function notificationHref(n: InAppNotification): string | null {
  const leadId = n.leadId || stringField(n.payload, "leadId");
  return leadId ? `/leads?leadId=${encodeURIComponent(leadId)}` : null;
}

export function slaPayload(n: InAppNotification): {
  leadName: string;
  stageName: string;
  ownerName: string;
  daysInStage: number | null;
  slaDays: number | null;
} {
  return {
    leadName: stringField(n.payload, "leadName") || "Lead",
    stageName: stringField(n.payload, "stageName") || "this stage",
    ownerName: stringField(n.payload, "ownerName"),
    daysInStage: numberField(n.payload, "daysInStage"),
    slaDays: numberField(n.payload, "slaDays"),
  };
}

export function typeLabel(type: string): string {
  if (type === SLA_TYPE) return "Stage SLA";
  return type;
}

function stringField(payload: Record<string, unknown> | null, key: string): string {
  const v = payload?.[key];
  return typeof v === "string" ? v : "";
}

function numberField(payload: Record<string, unknown> | null, key: string): number | null {
  const v = payload?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
