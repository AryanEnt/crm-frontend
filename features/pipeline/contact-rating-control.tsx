"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { crmApi, type LeadBoard, type LeadBoardCard } from "@/lib/api/crm";
import { cn } from "@/lib/utils";
import { contactRatingLabel, isContactedStage } from "./contact-rating";
import { ContactRatingFields, StarRow, contactRatingReady } from "./contact-rating-fields";

function patchBoardCard(
  board: LeadBoard | undefined,
  leadId: string,
  patch: Pick<LeadBoardCard, "contactRating" | "contactRemarks">,
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

/** Contacted-stage star rating + mandatory remarks; read-only after the lead leaves Contacted. */
export function ContactRatingControl({
  lead,
  stageName,
  canEdit,
  layout = "chip",
}: {
  lead: LeadBoardCard;
  stageName?: string | null;
  canEdit: boolean;
  layout?: "chip" | "panel";
}) {
  const contacted = isContactedStage(stageName);
  const savedRating = lead.contactRating ?? 0;
  const savedRemarks = (lead.contactRemarks ?? "").trim();
  const hasSaved = savedRating >= 1 && savedRemarks !== "";
  const editable = canEdit && contacted;
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [rating, setRating] = React.useState(savedRating);
  const [remarks, setRemarks] = React.useState(savedRemarks);
  const [draftKey, setDraftKey] = React.useState(`${open}:${savedRating}:${savedRemarks}`);
  const nextDraftKey = `${open}:${savedRating}:${savedRemarks}`;
  // Reset the draft when the popover closes or the saved values change while closed.
  if (draftKey !== nextDraftKey) {
    setDraftKey(nextDraftKey);
    if (!open) {
      setRating(savedRating);
      setRemarks(savedRemarks);
    }
  }

  const mutation = useMutation({
    mutationFn: (body: { contactRating: number; contactRemarks: string }) =>
      crmApi.updateLead(lead.id, { ...body, forceUpdate: true }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ["lead-board"] });
      const previous = qc.getQueriesData<LeadBoard>({ queryKey: ["lead-board"] });
      qc.setQueriesData<LeadBoard>({ queryKey: ["lead-board"] }, (board) =>
        patchBoardCard(board, lead.id, {
          contactRating: body.contactRating,
          contactRemarks: body.contactRemarks,
        }),
      );
      return { previous };
    },
    onError: (err, _body, ctx) => {
      for (const [key, data] of ctx?.previous ?? []) qc.setQueryData(key, data);
      toast.error("Couldn't save contact rating", {
        description: err instanceof Error && err.message ? err.message : undefined,
      });
    },
    onSuccess: () => {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["lead-board"] });
      void qc.invalidateQueries({ queryKey: ["lead", lead.id] });
      void qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  // Hide entirely when never rated and not in Contacted (nothing to show).
  if (!contacted && !hasSaved) return null;

  const label = contactRatingLabel(savedRating || null, savedRemarks);
  const canSave = contactRatingReady(rating, remarks);

  if (layout === "panel") {
    if (!editable) {
      return (
        <div className="mt-2 space-y-1.5">
          <StarRow value={savedRating} size="md" />
          <p className="whitespace-pre-wrap text-body text-ink">{savedRemarks || "—"}</p>
        </div>
      );
    }
    return (
      <div className="mt-2 space-y-3">
        <ContactRatingFields
          rating={rating}
          remarks={remarks}
          onRatingChange={setRating}
          onRemarksChange={setRemarks}
          disabled={mutation.isPending}
          remarksId={`contact-remarks-panel-${lead.id}`}
          starSize="md"
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            loading={mutation.isPending}
            disabled={!canSave || (rating === savedRating && remarks.trim() === savedRemarks)}
            onClick={() => mutation.mutate({ contactRating: rating, contactRemarks: remarks.trim() })}
          >
            Save rating
          </Button>
        </div>
      </div>
    );
  }

  if (!editable) {
    return (
      <p className="mt-2 truncate text-caption font-medium text-ink-secondary" title={label}>
        {label || "No contact rating"}
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
              hasSaved
                ? "border-warning/40 bg-warning-soft text-warning"
                : "border-dashed border-line text-ink-muted hover:border-line-strong hover:text-ink",
            )}
            aria-label={label ? `Contact rating: ${label}` : "Add contact rating"}
          >
            <Star className={cn("size-3 shrink-0", hasSaved && "fill-warning")} aria-hidden />
            <span className="truncate">{label || "Rate & remarks"}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-72 space-y-3 p-3"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div>
            <p className="text-sm font-semibold text-ink">Contact rating</p>
            <p className="text-caption text-ink-muted">
              Required before leaving Contacted. Locked after the lead moves on.
            </p>
          </div>
          <ContactRatingFields
            rating={rating}
            remarks={remarks}
            onRatingChange={setRating}
            onRemarksChange={setRemarks}
            disabled={mutation.isPending}
            remarksId={`contact-remarks-${lead.id}`}
            starSize="sm"
          />
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              loading={mutation.isPending}
              disabled={!canSave}
              onClick={() =>
                mutation.mutate({ contactRating: rating, contactRemarks: remarks.trim() })
              }
            >
              Save
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
