"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/console/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { nextActionTone } from "@/features/leads/lead-format";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi, type LeadBoard, type LeadBoardCard } from "@/lib/api/crm";
import { cn } from "@/lib/utils";

function patchBoardCard(
  board: LeadBoard | undefined,
  leadId: string,
  patch: Pick<LeadBoardCard, "documentDelayRemarks" | "documentDelayRemarksAt">,
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

/** Overdue document send-by remarks on Nurturing cards — SE write, TL/SA read. */
export function DocumentDelayRemarksControl({
  lead,
  canEdit,
}: {
  lead: LeadBoardCard;
  canEdit: boolean;
}) {
  const { user } = useAuth();
  const timezone = user?.timezone || undefined;
  const deadlineTone = nextActionTone(lead.documentDeadlineAt ?? null, timezone);
  const overdue = Boolean(lead.documentDeadlineAt) && deadlineTone === "overdue";
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const saved = (lead.documentDelayRemarks ?? "").trim();
  const [draft, setDraft] = React.useState(saved);

  React.useEffect(() => {
    if (!open) setDraft(saved);
  }, [open, saved]);

  const mutation = useMutation({
    mutationFn: (body: string) => crmApi.addDocumentDelayRemark(lead.id, body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ["lead-board"] });
      const previous = qc.getQueriesData<LeadBoard>({ queryKey: ["lead-board"] });
      const at = new Date().toISOString();
      qc.setQueriesData<LeadBoard>({ queryKey: ["lead-board"] }, (board) =>
        patchBoardCard(board, lead.id, { documentDelayRemarks: body, documentDelayRemarksAt: at }),
      );
      return { previous };
    },
    onError: (err, _body, ctx) => {
      for (const [key, data] of ctx?.previous ?? []) qc.setQueryData(key, data);
      toast.error("Couldn't save delay remarks", {
        description: err instanceof Error && err.message ? err.message : undefined,
      });
    },
    onSuccess: () => {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["lead-board"] });
      void qc.invalidateQueries({ queryKey: ["lead", lead.id] });
      void qc.invalidateQueries({ queryKey: ["lead", lead.id, "document-delay-remarks"] });
      void qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  if (!overdue) return null;

  if (!canEdit) {
    if (!saved) {
      return (
        <p className="mt-2 truncate text-caption text-danger/80" title="No delay remarks yet">
          Overdue · no remarks
        </p>
      );
    }
    return (
      <p className="mt-2 truncate text-caption font-medium text-danger" title={saved}>
        Delay · {saved}
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
              "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-left text-[0.6875rem] font-medium",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              saved
                ? "border-danger/35 bg-danger-soft text-danger"
                : "border-dashed border-danger/40 text-danger hover:bg-danger-soft/50",
            )}
            aria-label={saved ? `Delay remarks: ${saved}` : "Add delay remarks"}
          >
            <MessageSquareText className="size-3 shrink-0 opacity-80" aria-hidden />
            <span className="truncate">{saved ? `Delay · ${saved}` : "Add delay remarks"}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-72 space-y-2 p-3"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div>
            <p className="text-sm font-semibold text-ink">{saved ? "Update delay remarks" : "Why are documents late?"}</p>
            <p className="text-caption text-ink-muted">
              Visible to your Team Lead and admins. Previous notes are kept in history.
            </p>
          </div>
          <Textarea
            id={`delay-remarks-${lead.id}`}
            rows={3}
            maxLength={1000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Client travelling; docs expected next week"
            autoFocus
            className="min-h-[72px] text-sm"
          />
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              loading={mutation.isPending}
              disabled={!draft.trim() || draft.trim() === saved}
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
