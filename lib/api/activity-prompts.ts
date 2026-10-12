import { api } from "@/lib/api/client";

export type PromptResult = "no_answer" | "contacted" | "qualified" | "not_qualified";

export type ActivityPrompt = {
  activityId: string;
  title: string;
  kind: string;
  typeName?: string | null;
  dueAt: string;
  leadId: string;
  leadName: string;
  leadPhone?: string | null;
  stageName?: string | null;
  priority: string;
  source: string;
};

export type PromptOutcome = {
  result: PromptResult;
  stage: { moved: boolean; stageId: string | null; stageName: string | null; message: string };
  needsNextActivity: boolean;
};

export const activityPromptsApi = {
  due: () => api.get<ActivityPrompt[]>("/activities/prompts"),
  answer: (activityId: string, body: { result: PromptResult; note?: string }) =>
    api.post<PromptOutcome>(`/activities/${activityId}/outcome`, body),
  snooze: (activityId: string, minutes: number) =>
    api.post<{ snoozedUntil: string }>(`/activities/${activityId}/snooze`, { minutes }),
  scheduleFollowUp: (leadId: string, dueAt: string) =>
    api.post<{ id: string }>("/activities", {
      title: "Follow up",
      typeCode: "follow_up",
      kind: "follow_up",
      status: "upcoming",
      leadId,
      dueAt,
    }),
};
