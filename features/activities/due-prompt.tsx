"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";
import { activityPromptsApi, type ActivityPrompt, type PromptResult } from "@/lib/api/activity-prompts";
import { cn } from "@/lib/utils";

const PROMPTS_KEY = ["activity-prompts"] as const;
const SNOOZE_MINUTES = 10;

const ANSWERS: Array<{ result: PromptResult; label: string; className?: string }> = [
  { result: "no_answer", label: "Couldn't reach" },
  { result: "contacted", label: "Talked, still deciding" },
  {
    result: "qualified",
    label: "Qualified",
    className: "border-stage-won/30 bg-stage-won-soft text-stage-won-ink hover:bg-stage-won/20",
  },
  {
    result: "not_qualified",
    label: "Not qualified",
    className: "border-stage-lost/30 bg-stage-lost-soft text-stage-lost-ink hover:bg-stage-lost/20",
  },
];

const FOLLOW_UPS: Array<{ label: string; at: () => Date }> = [
  { label: "In 1 hour", at: () => new Date(Date.now() + 60 * 60_000) },
  { label: "Tomorrow 10 AM", at: () => dayAt(1, 10) },
  { label: "In 3 days", at: () => dayAt(3, 10) },
];

function dayAt(daysAhead: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function formatDue(iso: string) {
  return new Date(iso).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** Bottom-right "How did it go?" card for the caller's lead activities once their time comes. */
export function DuePrompt() {
  const { user, can } = useAuth();
  const enabled = Boolean(user) && can("activities:edit");
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: PROMPTS_KEY,
    queryFn: activityPromptsApi.due,
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
  const [handled, setHandled] = React.useState<string[]>([]);
  const [note, setNote] = React.useState("");
  const [followUp, setFollowUp] = React.useState<{ leadId: string; leadName: string } | null>(null);

  const prompts = (query.data ?? []).filter((p) => !handled.includes(p.activityId));
  const current = prompts[0];

  const done = (activityId: string) => {
    setHandled((h) => [...h, activityId]);
    setNote("");
    void qc.invalidateQueries({ queryKey: PROMPTS_KEY });
  };

  const refreshLeadViews = () => {
    for (const key of ["lead-board", "leads", "activities", "calendar", "calls"]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };

  const answer = useMutation({
    mutationFn: ({ prompt, result }: { prompt: ActivityPrompt; result: PromptResult }) =>
      activityPromptsApi.answer(prompt.activityId, { result, note: note.trim() || undefined }),
    onSuccess: (out, { prompt }) => {
      done(prompt.activityId);
      refreshLeadViews();
      if (out.stage.moved) toast.success(`${prompt.leadName} moved to ${out.stage.stageName}`);
      else if (out.stage.message) toast(`Saved. ${out.stage.message}`);
      else toast.success("Saved");
      if (out.needsNextActivity && out.result !== "not_qualified") {
        setFollowUp({ leadId: prompt.leadId, leadName: prompt.leadName });
      }
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't save your answer. Try again.")),
  });

  const snooze = useMutation({
    mutationFn: (prompt: ActivityPrompt) => activityPromptsApi.snooze(prompt.activityId, SNOOZE_MINUTES),
    onSuccess: (_out, prompt) => done(prompt.activityId),
    onError: (err) => toast.error(errorMessage(err, "Couldn't snooze. Try again.")),
  });

  const schedule = useMutation({
    mutationFn: ({ leadId, at }: { leadId: string; at: Date }) =>
      activityPromptsApi.scheduleFollowUp(leadId, at.toISOString()),
    onSuccess: () => {
      setFollowUp(null);
      refreshLeadViews();
      toast.success("Follow-up scheduled");
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't schedule the follow-up. Try again.")),
  });

  if (!enabled) return null;

  if (followUp) {
    return (
      <PromptCard label="Schedule next step">
        <p className="text-[0.8125rem] text-ink-secondary">
          <span className="font-semibold text-ink">{followUp.leadName}</span> has no next step. When should you follow up?
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {FOLLOW_UPS.map((f) => (
            <Button
              key={f.label}
              size="sm"
              variant="outline"
              disabled={schedule.isPending}
              onClick={() => schedule.mutate({ leadId: followUp.leadId, at: f.at() })}
            >
              {f.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" disabled={schedule.isPending} onClick={() => setFollowUp(null)}>
            Not now
          </Button>
        </div>
      </PromptCard>
    );
  }

  if (!current) return null;
  const busy = answer.isPending || snooze.isPending;

  return (
    <PromptCard
      label={`${current.typeName || "Activity"} due`}
      count={prompts.length}
      onClose={() => snooze.mutate(current)}
      closeLabel={`Remind me in ${SNOOZE_MINUTES} minutes`}
    >
      <div className="min-w-0">
        <p className="truncate text-[0.9375rem] font-semibold text-ink">{current.title}</p>
        <p className="mt-0.5 truncate text-[0.8125rem] text-ink-secondary">
          <Link href={`/leads?leadId=${current.leadId}`} className="font-medium text-ink hover:underline">
            {current.leadName}
          </Link>
          {current.stageName ? ` · ${current.stageName}` : ""}
          {` · ${formatDue(current.dueAt)}`}
        </p>
        {current.leadPhone ? (
          <a href={`tel:${current.leadPhone}`} className="mt-0.5 block font-mono text-caption tabular-nums text-ink-muted">
            {current.leadPhone}
          </a>
        ) : null}
      </div>

      <p className="mt-3 text-[0.8125rem] font-medium text-ink">How did it go?</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {ANSWERS.map((a) => (
          <Button
            key={a.result}
            size="sm"
            variant="outline"
            disabled={busy}
            className={cn("h-auto min-h-8 whitespace-normal py-1.5 leading-tight", a.className)}
            onClick={() => answer.mutate({ prompt: current, result: a.result })}
          >
            {a.label}
          </Button>
        ))}
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        placeholder="Add a note (optional)"
        aria-label="Note about this activity"
        className="mt-2 h-8 w-full rounded-control border border-line bg-surface px-2.5 text-[0.8125rem] text-ink placeholder:text-ink-muted focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => snooze.mutate(current)}
        className="mt-2 text-caption font-medium text-ink-muted hover:text-ink disabled:opacity-50"
      >
        Remind me in {SNOOZE_MINUTES} min
      </button>
    </PromptCard>
  );
}

function PromptCard({
  label,
  count,
  onClose,
  closeLabel,
  children,
}: {
  label: string;
  count?: number;
  onClose?: () => void;
  closeLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      role="dialog"
      aria-label={label}
      className="fixed bottom-4 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-4 shadow-lift motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
    >
      <div className="mb-2 flex items-center gap-2">
        <BellRing aria-hidden className="size-4 text-brand" />
        <span className="flex-1 text-caption font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
        {count && count > 1 ? <span className="text-caption tabular-nums text-ink-muted">1 of {count}</span> : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
            className="grid size-6 place-items-center rounded-control text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}
