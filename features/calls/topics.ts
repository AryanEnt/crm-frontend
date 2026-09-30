import type { CallContext } from "@/lib/api/calls";

/**
 * Conversation topics for the Calls workspace.
 *
 * This file is configuration only: topic ids, labels, default questions, and a
 * mapper that reads what the CRM already knows for that topic. It never holds
 * customer data. Team- or pipeline-specific topic sets can later be loaded in
 * this same shape and passed to the workspace instead of DEFAULT_TOPICS.
 */

export type KnownFact = { label: string; value: string };

export type TopicDefinition = {
  /** Stored on notes; must match ^[a-z][a-z0-9_]{0,39}$. */
  id: string;
  label: string;
  questions: string[];
  known: (ctx: CallContext) => KnownFact[];
};

export function formatDate(value?: string | null) {
  if (!value) return "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatMoney(value?: number | null, currency = "AUD") {
  if (value == null) return "";
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

const EVENT_LABELS: Record<string, string> = {
  call: "Call",
  whatsapp: "WhatsApp",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
  "activity.created": "Activity",
  "activity.completed": "Activity completed",
  stage_change: "Stage change",
  assignment_change: "Assignment",
  "lead.created": "Lead created",
  "customer.created": "Customer created",
  "deal.created": "Deal created",
  "document.requested": "Document requested",
  "document.uploaded": "Document uploaded",
  "document.verified": "Document verified",
  "document.rejected": "Document rejected",
  "automation.event": "Automation",
};

export function eventLabel(eventType: string) {
  return EVENT_LABELS[eventType] ?? eventType.replace(/[._]/g, " ");
}

function fact(label: string, value: string | null | undefined): KnownFact[] {
  const v = value?.trim();
  return v ? [{ label, value: v }] : [];
}

const openDeals = (ctx: CallContext) => ctx.deals.filter((d) => d.status === "open");

export const DEFAULT_TOPICS: TopicDefinition[] = [
  {
    id: "requirements",
    label: "Requirements",
    questions: [
      "What are you currently looking for?",
      "Which occupation or pathway are you considering?",
      "Is there anything that must be in place for this to work for you?",
    ],
    known: ({ person: p }) => [
      ...fact("Occupation (ANZSCO)", p.anzscoCode ? `${p.anzscoCode} ${p.anzscoTitle ?? ""}` : ""),
      ...fact("Occupation", p.occupation),
      ...fact("Job title", p.jobTitle),
      ...fact("Qualification", p.qualification),
      ...fact("Experience", p.experienceYears != null ? `${p.experienceYears} years` : ""),
      ...fact("Skills", p.skills.join(", ")),
    ],
  },
  {
    id: "goals",
    label: "Goals",
    questions: [
      "What outcome would make this worthwhile for you?",
      "Has anything changed since our last discussion?",
    ],
    known: ({ person: p }) => fact("Expected outcome", p.expectedOutcome),
  },
  {
    id: "timeline",
    label: "Timeline",
    questions: ["What is your preferred timeline?", "Are there any dates we need to work around?"],
    known: (ctx) => [
      ...fact("Next follow-up", formatDateTime(ctx.person.nextFollowUpAt)),
      ...openDeals(ctx).flatMap((d) => fact(`Expected close · ${d.title}`, formatDate(d.expectedCloseAt))),
    ],
  },
  {
    id: "budget",
    label: "Budget",
    questions: ["Do you have a budget in mind?", "Who else contributes to the cost, if anyone?"],
    known: (ctx) => [
      ...fact("Potential value", formatMoney(ctx.person.potentialValue)),
      ...openDeals(ctx).flatMap((d) => fact(`Deal value · ${d.title}`, formatMoney(d.value, d.currency))),
    ],
  },
  {
    id: "previous_discussion",
    label: "Previous Discussion",
    questions: ["Has anything changed since our last discussion?", "Did you have a chance to review what we sent?"],
    known: (ctx) => {
      const last = ctx.lastInteraction;
      return [
        ...fact(
          "Last interaction",
          last ? `${eventLabel(last.eventType)} · ${formatDate(last.occurredAt)}${last.body ? ` — ${last.body}` : ""}` : "",
        ),
        ...fact("Record notes", ctx.person.notes),
      ];
    },
  },
  {
    id: "concerns",
    label: "Concerns",
    questions: ["Is there anything you are unsure about?", "What would you like us to clarify?"],
    known: () => [],
  },
  {
    id: "objections",
    label: "Objections",
    questions: ["What is holding you back from going ahead?", "What would need to change for this to work?"],
    known: (ctx) =>
      ctx.deals
        .filter((d) => d.status === "lost")
        .flatMap((d) => fact(`Lost reason · ${d.title}`, d.lostReason)),
  },
  {
    id: "documents",
    label: "Documents",
    questions: ["Which documents do you already have ready?", "Is anything difficult to obtain?"],
    known: (ctx) => ctx.documents.map((d) => ({ label: d.name, value: d.status })),
  },
  {
    id: "decision_makers",
    label: "Decision Makers",
    questions: ["Who else is involved in this decision?", "Would it help to include them in our next conversation?"],
    known: () => [],
  },
  {
    id: "next_steps",
    label: "Next Steps",
    questions: ["What would you like the next step to be?", "When is a good time to follow up?"],
    known: (ctx) =>
      ctx.upcoming.map((a) => ({
        label: a.typeName ?? a.kind,
        value: a.dueAt ? `${a.title} · ${formatDateTime(a.dueAt)}` : a.title,
      })),
  },
];

export function topicLabel(id: string, topics: TopicDefinition[] = DEFAULT_TOPICS) {
  return topics.find((t) => t.id === id)?.label ?? id.replace(/_/g, " ");
}

/** Static guidance shown on the Guide tab; not CRM data. */
export const GUIDE_QUESTIONS = [
  "What are you currently looking for?",
  "Has anything changed since our last discussion?",
  "What is your preferred timeline?",
  "Is there anything you are unsure about?",
  "What would you like us to clarify?",
];

export const GUIDE_CLARIFY: Array<{ label: string; topicId: string }> = [
  { label: "Requirements", topicId: "requirements" },
  { label: "Timeline", topicId: "timeline" },
  { label: "Budget", topicId: "budget" },
  { label: "Current situation", topicId: "previous_discussion" },
  { label: "Concerns", topicId: "concerns" },
  { label: "Next steps", topicId: "next_steps" },
];
