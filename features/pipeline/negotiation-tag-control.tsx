"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/console/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { crmApi, type LeadBoard, type LeadBoardCard } from "@/lib/api/crm";
import { cn } from "@/lib/utils";
import {
  NEGOTIATION_TAGS,
  NEGOTIATION_TAG_META,
  negotiationTagLabel,
  negotiationTagTone,
  type NegotiationTag,
  type NegotiationTagTone,
} from "./negotiation-tag";

const TONE_CHIP: Record<NegotiationTagTone, string> = {
  warning: "border-warning/40 bg-warning-soft/80 text-warning",
  success: "border-success/40 bg-success-soft/80 text-success",
  danger: "border-danger/40 bg-danger-soft/80 text-danger",
  info: "border-brand/30 bg-brand-soft/80 text-brand-ink",
  neutral: "border-line bg-surface-muted text-ink-secondary",
};

const TONE_DOT: Record<NegotiationTagTone, string> = {
  warning: "bg-warning",
  success: "bg-success",
  danger: "bg-danger",
  info: "bg-brand",
  neutral: "bg-ink-muted",
};

function patchBoardCard(
  board: LeadBoard | undefined,
  leadId: string,
  patch: Pick<LeadBoardCard, "negotiationTag" | "negotiationRemarks">,
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

/** Compact negotiation status chip — readable, not loud. */
export function NegotiationTagControl({
  lead,
  canEdit,
}: {
  lead: LeadBoardCard;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [draftTag, setDraftTag] = React.useState<NegotiationTag | "">(
    (lead.negotiationTag as NegotiationTag) || "",
  );
  const [remarks, setRemarks] = React.useState(lead.negotiationRemarks ?? "");
  const savedTag = lead.negotiationTag ?? "";
  const savedRemarks = lead.negotiationRemarks ?? "";

  React.useEffect(() => {
    if (!open) {
      setDraftTag((savedTag as NegotiationTag) || "");
      setRemarks(savedRemarks);
    }
  }, [open, savedTag, savedRemarks]);

  const mutation = useMutation({
    mutationFn: (body: { negotiationTag: string; negotiationRemarks: string }) =>
      crmApi.updateLead(lead.id, { ...body, forceUpdate: true }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ["lead-board"] });
      const previous = qc.getQueriesData<LeadBoard>({ queryKey: ["lead-board"] });
      qc.setQueriesData<LeadBoard>({ queryKey: ["lead-board"] }, (board) =>
        patchBoardCard(board, lead.id, {
          negotiationTag: body.negotiationTag,
          negotiationRemarks: body.negotiationRemarks,
        }),
      );
      return { previous };
    },
    onError: (err, _body, ctx) => {
      for (const [key, data] of ctx?.previous ?? []) qc.setQueryData(key, data);
      toast.error("Couldn't save negotiation status", {
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

  const save = (tag: string, note: string) => {
    if (tag === "Others" && !note.trim()) {
      toast.error("Add a short note for Others");
      return;
    }
    mutation.mutate({
      negotiationTag: tag,
      negotiationRemarks: tag === "Others" ? note.trim() : "",
    });
  };

  const label = negotiationTagLabel(savedTag, savedRemarks);
  const tone = negotiationTagTone(savedTag);
  const showRemarks = draftTag === "Others";
  const hasTag = Boolean(savedTag);

  if (!canEdit) {
    if (!label) return null;
    return (
      <p
        className={cn(
          "mt-2 inline-flex max-w-full truncate rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium",
          TONE_CHIP[tone],
        )}
        title={label}
      >
        {label}
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
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={mutation.isPending}
            className={cn(
              "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-left text-[0.6875rem] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              hasTag
                ? TONE_CHIP[tone]
                : "border-dashed border-line text-ink-muted hover:border-line-strong hover:text-ink",
            )}
            aria-label={label ? `Negotiation status: ${label}` : "Set negotiation status"}
            title={hasTag ? label : "Set negotiation status"}
          >
            {!hasTag ? (
              <span className={cn("size-1.5 shrink-0 rounded-full bg-ink-muted/50")} aria-hidden />
            ) : (
              <span className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])} aria-hidden />
            )}
            <span className="truncate">{label || "Set status"}</span>
            <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-60 p-1"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {NEGOTIATION_TAGS.map((tag) => {
            const meta = NEGOTIATION_TAG_META[tag];
            const active = savedTag === tag;
            return (
              <DropdownMenuItem
                key={tag}
                disabled={mutation.isPending}
                onSelect={(e) => {
                  if (tag === "Others") {
                    e.preventDefault();
                    setDraftTag(tag);
                    return;
                  }
                  save(tag, "");
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-start gap-0.5 rounded-md px-2 py-1.5",
                  active && "bg-surface-muted",
                )}
              >
                <span className="flex items-center gap-2 text-[0.8125rem] font-medium text-ink">
                  <span className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[meta.tone])} aria-hidden />
                  {tag}
                </span>
                <span className="pl-3.5 text-[0.6875rem] leading-snug text-ink-muted">{meta.hint}</span>
              </DropdownMenuItem>
            );
          })}
          {showRemarks ? (
            <div
              className="mt-1 space-y-2 border-t border-line px-2 pb-2 pt-2"
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <label className="block text-caption font-medium text-ink" htmlFor={`neg-remarks-${lead.id}`}>
                Note
              </label>
              <Textarea
                id={`neg-remarks-${lead.id}`}
                rows={2}
                maxLength={400}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Short note for the team"
                autoFocus
                className="min-h-[52px] text-sm"
              />
              <div className="flex justify-end gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDraftTag((savedTag as NegotiationTag) || "");
                    setRemarks(savedRemarks);
                    setOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  loading={mutation.isPending}
                  disabled={!remarks.trim()}
                  onClick={() => save("Others", remarks)}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
