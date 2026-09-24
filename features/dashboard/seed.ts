import {
  DollarSign,
  Target,
  TrendingUp,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { ActivityItemProps } from "@/components/ui/activity-item";
import type { TimelineItem } from "@/components/ui/timeline";
import { formatCurrency } from "@/lib/utils";

export const dashboardMetrics: Array<{
  label: string;
  value: string;
  delta: number;
  hint: string;
  icon: LucideIcon;
}> = [
  {
    label: "Open pipeline",
    value: formatCurrency(428000),
    delta: 8.2,
    hint: "vs last week",
    icon: DollarSign,
  },
  {
    label: "New leads",
    value: "36",
    delta: 12,
    hint: "last 7 days",
    icon: UserPlus,
  },
  {
    label: "Win rate",
    value: "27%",
    delta: -1.4,
    hint: "rolling 30d",
    icon: TrendingUp,
  },
  {
    label: "Quota attainment",
    value: "68%",
    delta: 4.1,
    hint: "this quarter",
    icon: Target,
  },
];

export const dashboardPipeline = [
  { name: "Qualification", count: 42, percent: 100 },
  { name: "Discovery", count: 28, percent: 67 },
  { name: "Proposal", count: 16, percent: 38 },
  { name: "Negotiation", count: 9, percent: 21 },
  { name: "Closed Won", count: 5, percent: 12 },
];

export const dashboardTarget = {
  current: formatCurrency(272000),
  goal: formatCurrency(400000),
  percent: 68,
  note: "On pace if Negotiation deals close this month.",
};

export const dashboardActivities: Array<ActivityItemProps & { id: string }> = [
  {
    id: "1",
    kind: "call",
    title: "Discovery call — Northwind Health",
    subtitle: "Confirm budget & timeline",
    actor: "Nikhil K.",
    time: "10:00",
    status: "Scheduled",
  },
  {
    id: "2",
    kind: "email",
    title: "Send proposal follow-up",
    subtitle: "BrightPath Retail · Enterprise plan",
    actor: "Asha R.",
    time: "11:30",
    status: "Due",
  },
  {
    id: "3",
    kind: "meeting",
    title: "Demo with Contoso Ops",
    subtitle: "Product walkthrough for 4 stakeholders",
    actor: "Nikhil K.",
    time: "14:00",
    status: "Confirmed",
  },
  {
    id: "4",
    kind: "task",
    title: "Update lead scoring rules",
    subtitle: "Marketing handoff alignment",
    actor: "Jordan L.",
    time: "16:30",
  },
];

export const dashboardFollowUps = [
  {
    id: "f1",
    title: "Meridian Labs — pricing objection",
    with: "Priya Shah · VP Sales",
    when: "Today · 3:15 PM",
    channel: "Call",
    urgent: true,
  },
  {
    id: "f2",
    title: "Orbit Systems — contract redlines",
    with: "Legal review pending",
    when: "Tomorrow · 9:00 AM",
    channel: "Email",
    urgent: false,
  },
  {
    id: "f3",
    title: "Cedar Clinics — renewals check-in",
    with: "Account health review",
    when: "Thu · 11:00 AM",
    channel: "Meeting",
    urgent: false,
  },
];

export const dashboardRecent: TimelineItem[] = [
  {
    id: "r1",
    title: "Deal moved to Negotiation",
    description: "BrightPath Retail · $48,000",
    timestamp: "12m ago",
    tone: "brand",
  },
  {
    id: "r2",
    title: "Lead converted to customer",
    description: "Helix Analytics",
    timestamp: "1h ago",
    tone: "success",
  },
  {
    id: "r3",
    title: "Document uploaded",
    description: "MSA draft · Contoso Ops",
    timestamp: "2h ago",
    tone: "neutral",
  },
  {
    id: "r4",
    title: "Follow-up missed",
    description: "Acme Freight — overdue by 1 day",
    timestamp: "Yesterday",
    tone: "warning",
  },
];
