import { formatMoney } from "@/features/analytics/charts";
import type { CrmTarget } from "@/lib/api/crm";

export type Goal = {
  code: string;
  label: string;
  /** One line under the option in the picker. */
  hint: string;
  /** What the backend counts, phrased to follow "Counts …". */
  counts: string;
  /** Singular and plural unit; money goals have none. */
  unit?: [string, string];
};

export const GOALS: Goal[] = [
  { code: "leads", label: "New leads", hint: "Every lead added in the period.", counts: "new leads added", unit: ["lead", "leads"] },
  { code: "leads_won", label: "Leads won", hint: "Every lead moved to Won in the period.", counts: "leads moved to Won", unit: ["lead", "leads"] },
  { code: "won_lead_value", label: "Won value", hint: "Total value of the leads won.", counts: "the value of leads moved to Won" },
  { code: "activities", label: "Activities (any)", hint: "Calls, meetings, tasks — every type.", counts: "activities logged", unit: ["activity", "activities"] },
  { code: "activities_calls", label: "Calls", hint: "Phone calls logged in the period.", counts: "calls logged", unit: ["call", "calls"] },
  { code: "activities_meetings", label: "Meetings", hint: "Meetings logged in the period.", counts: "meetings logged", unit: ["meeting", "meetings"] },
];

export const MORE_GOALS: Goal[] = [
  { code: "proposal_entries", label: "Leads reaching Proposal", hint: "Leads that entered the Proposal stage in the period.", counts: "leads that entered Proposal", unit: ["lead", "leads"] },
  { code: "open_lead_value", label: "Open lead value", hint: "Value of open leads right now, not limited to the period.", counts: "the value of open leads right now" },
];

/** Activity-style metrics that open the Activities list when you click the card. */
export const ACTIVITY_GOALS = new Set(["activities", "activities_calls", "activities_meetings"]);

/** URL filter for /activities?type=…, or "" for any type. */
export function activitiesHrefFor(metric: string): string {
  if (metric === "activities_calls") return "/activities?type=call";
  if (metric === "activities_meetings") return "/activities?type=meeting";
  return "/activities";
}

/** Deal-era metrics: still shown on existing targets, never offered for new ones. */
const LEGACY_GOALS: Goal[] = [
  { code: "qualified_leads", label: "Qualified leads (legacy)", hint: "", counts: "new leads that were qualified", unit: ["lead", "leads"] },
  { code: "positive_outcomes", label: "Deals won (legacy)", hint: "", counts: "deals moved to Won", unit: ["deal", "deals"] },
  { code: "won_revenue", label: "Revenue won (legacy)", hint: "", counts: "the value of deals moved to Won" },
  { code: "conversions", label: "Leads converted (legacy)", hint: "", counts: "leads converted to customers", unit: ["lead", "leads"] },
  { code: "submissions", label: "Deals submitted (legacy)", hint: "", counts: "new deals that reached a submission stage", unit: ["deal", "deals"] },
  { code: "pipeline_value", label: "Open deal value (legacy)", hint: "", counts: "the value of open deals right now" },
];

export const ALL_GOALS = [...GOALS, ...MORE_GOALS, ...LEGACY_GOALS];

export function goalFor(code: string): Goal {
  return ALL_GOALS.find((g) => g.code === code) ?? { code, label: code, hint: "", counts: code, unit: ["", ""] };
}

export function formatAmount(goal: Goal, n: number, withUnit = false) {
  if (!goal.unit) return formatMoney(n);
  const v = Math.round(n * 100) / 100;
  return withUnit ? `${v} ${v === 1 ? goal.unit[0] : goal.unit[1]}`.trim() : String(v);
}

export function whoName(t: CrmTarget) {
  if (t.scopeType === "team") return t.teamName ?? "Team";
  if (t.scopeType === "user") return t.userName ?? "Person";
  return "Everyone";
}

const DEFAULT_NAME = /^(daily|monthly|quarterly) [a-z_]+ target$/;

/** The name someone typed, or "" when the backend generated it. */
export function customTargetName(t: CrmTarget) {
  return t.name && !DEFAULT_NAME.test(t.name) ? t.name : "";
}
