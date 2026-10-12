import type { Activity } from "@/lib/api/crm";

export function leadHref(leadId: string) {
  return `/leads?leadId=${encodeURIComponent(leadId)}`;
}

/** The record an activity belongs to: its lead's detail panel, else the calendar. */
export function activityHref(a: Activity) {
  if (a.leadId) return leadHref(a.leadId);
  return "/calendar";
}
