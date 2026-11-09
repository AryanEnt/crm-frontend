"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ListTodo } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/console/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { crmApi, type LeadBoard, type LeadBoardCard } from "@/lib/api/crm";
import { cn } from "@/lib/utils";
import {
  nextFollowUpRemarksLabel,
  nextFollowUpRemarksProblem,
  requiresNextFollowUpRemarks,
} from "./next-follow-up-remarks";

function patchBoardCard(
  board: LeadBoard | undefined,
  leadId: string,
  patch: Pick<LeadBoardCard, "nextFollowUpRemarks">,
): LeadBoard | undefined {
  if (!board) return board;
  return {
    ...board,
    stages: board.stages.map((s) => ({
      ...s,
      leads: s.leads.map((l) => (l.id === leadId ? { ...l, ...patch } : l)),
    })),
  };
}

/** Next follow-up plan on Contacted → Lost cards — SE write, TL read. */
export function NextFollowUpRemarksControl({
  lead,
  stageName,
  canEdit,
  layout = "chip",
}: {
  lead: LeadBoardCard;
  stageName: string | null | undefined;
  canEdit: boolean;
  layout?: "chip" | "panel";
}) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const saved = (lead.nextFollowUpRemarks ?? "").trim();
  const [draft, setDraft] = React.useState(saved);
  const needed = requiresNextFollowUpRemarks(stageName);
  const [draftKey, setDraftKey] = React.useState(`${open}:${saved}`);
  const nextDraftKey = `${open}:${saved}`;
  if (draftKey !== nextDraftKey) {
    setDraftKey(nextDraftKey);
    if (!open) setDraft(saved);
  }

  const mutation = useMutation({
    mutationFn: (body: string) =>
      crmApi.updateLead(lead.id, { nextFollowUpRemarks: body, forceUpdate: true }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ["lead-board"] });
      const previous = qc.getQueriesData<LeadBoard>({ queryKey: ["lead-board"] });
      qc.setQueriesData<LeadBoard>({ queryKey: ["lead-board"] }, (board) =>
        patchBoardCard(board, lead.id, { nextFollowUpRemarks: body }),
      );
      return { previous };
    },
    onError: (err, _body, ctx) => {
      for (const [key, data] of ctx?.previous ?? []) qc.setQueryData(key, data);
      toast.error("Couldn't save follow-up remarks", {
        description: err instanceof Error && err.message ? err.message : undefined,
      });
    },
    onSuccess: () => {
      setOpen(false);
      toast.success("Next follow-up updated");
      void qc.invalidateQueries({ queryKey: ["lead-board"] });
      void qc.invalidateQueries({ queryKey: ["lead", lead.id] });
      void qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  if (!needed && !saved) return null;

  const label = nextFollowUpRemarksLabel(saved);
  const problem = nextFollowUpRemarksProblem(draft);
  const canSave = !problem && draft.trim() !== saved;
  const missing = needed && !saved;

  if (layout === "panel") {
    if (!canEdit) {
      return (
        <p className={cn("mt-2 whitespace-pre-wrap text-body", missing ? "text-warning" : "text-ink")}>
          {saved || "No next follow-up set"}
        </p>
      );
    }
    return (
      <div className="mt-2 space-y-2">
        <Textarea
          id={`next-follow-up-panel-${lead.id}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={mutation.isPending}
          rows={3}
          placeholder="e.g. Call Thursday to review fee options and send brochure"
          className="min-h-[4.5rem] resize-none text-sm"
        />
        {draft.trim() && problem ? (
          <p className="text-caption text-danger" role="alert">
            {problem}
          </p>
        ) : missing ? (
          <p className="text-caption text-warning">Required before this lead can move on.</p>
        ) : null}
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            loading={mutation.isPending}
            disabled={!canSave}
            onClick={() => mutation.mutate(draft.trim())}
          >
            Save plan
          </Button>
        </div>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <p
        className={cn(
          "mt-2 flex min-w-0 items-start gap-1.5 text-caption",
          missing ? "font-medium text-warning" : "font-medium text-ink-secondary",
        )}
        title={saved || "No next follow-up plan yet"}
      >
        <ListTodo className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">
          {missing ? "No next follow-up set" : label}
        </span>
      </p>
    );
  }

  return (
    <div
      className="mt-2"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={mutation.isPending}
            className={cn(
              "flex w-full max-w-full items-start gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[0.6875rem] leading-snug transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              missing
                ? "border-dashed border-warning/50 bg-warning-soft/50 text-warning hover:border-warning hover:bg-warning-soft"
                : "border-line/80 bg-surface-muted/60 text-ink-secondary hover:border-line-strong hover:bg-surface-muted hover:text-ink",
            )}
            aria-label={saved ? `Next follow-up: ${saved}` : "Add next follow-up remarks"}
            title={saved || "Add next follow-up remarks"}
          >
            <ListTodo className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0">
              <span className={cn("block font-semibold", missing ? "text-warning" : "text-ink-secondary")}>
                Next follow-up
              </span>
              <span className="mt-0.5 line-clamp-2 block font-medium">
                {label || "Required — add the next action"}
              </span>
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-80 space-y-3 p-3.5"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div>
            <p className="text-sm font-semibold text-ink">Next follow-up remarks</p>
            <p className="mt-0.5 text-caption text-ink-muted">
              Document the next planned action. Required on Contacted through Lost.
            </p>
          </div>
          <Textarea
            id={`next-follow-up-${lead.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={mutation.isPending}
            rows={4}
            placeholder="e.g. Call Thursday to review fee options and send brochure"
            className="min-h-[5.5rem] resize-none text-[0.8125rem]"
          />
          {draft.trim() && problem ? (
            <p className="text-caption text-danger" role="alert">
              {problem}
            </p>
          ) : (
            <p className="text-caption text-ink-muted">Keep this updated whenever the plan changes.</p>
          )}
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              loading={mutation.isPending}
              disabled={!canSave}
              onClick={() => mutation.mutate(draft.trim())}
            >
              Save
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
