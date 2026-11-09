"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/auth-provider";
import { EmailComposer } from "@/features/email/email-composer";
import { moveCard } from "@/features/leads/lead-board-state";
import { emailApi } from "@/lib/api/email";
import { crmApi, type LeadBoard, type LeadBoardCard, type LeadBoardStage } from "@/lib/api/crm";
import { cn } from "@/lib/utils";
import { isFileDeliveredStage } from "./nurturing-stages";

/** Clients-stage email: send via CRM mail, then advance the card to File Delivered. */
export function ClientsEmailControl({
  lead,
  stages,
  canEdit,
}: {
  lead: LeadBoardCard;
  stages: LeadBoardStage[];
  canEdit: boolean;
}) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  // Board stages are already active-only — do not check s.isActive (it isn't on LeadBoardStage).
  const fileDelivered = stages.find((s) => isFileDeliveredStage(s.name));
  const canSend = can("email:send");

  const accountsQuery = useQuery({
    queryKey: ["email-accounts"],
    queryFn: () => emailApi.listAccounts(),
    enabled: canSend || can("email:view"),
  });
  const accountsLoading = accountsQuery.isLoading || accountsQuery.isFetching;
  const account = accountsQuery.data?.accounts?.[0] ?? null;

  const moveMutation = useMutation({
    mutationFn: (to: LeadBoardStage) =>
      crmApi.moveLead(lead.id, { stageId: to.id, force: true }),
    onMutate: async (to) => {
      await qc.cancelQueries({ queryKey: ["lead-board"] });
      const previous = qc.getQueriesData<LeadBoard>({ queryKey: ["lead-board"] });
      qc.setQueriesData<LeadBoard>({ queryKey: ["lead-board"] }, (board) =>
        board ? moveCard(board, lead.id, to.id) : board,
      );
      return { previous };
    },
    onError: (err, _to, ctx) => {
      for (const [key, data] of ctx?.previous ?? []) qc.setQueryData(key, data);
      toast.error("Email sent, but couldn't move to File Delivered", {
        description: err instanceof Error && err.message ? err.message : "Move the card manually.",
      });
    },
    onSuccess: (_res, to) => {
      toast.success("Email sent", {
        description: `${lead.fullName} moved to ${to.name}`,
      });
      void qc.invalidateQueries({ queryKey: ["lead-board"] });
      void qc.invalidateQueries({ queryKey: ["lead", lead.id] });
      void qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  if (!canEdit) return null;

  const hasEmail = Boolean(lead.email?.trim());
  const ready = Boolean(account && canSend && hasEmail && fileDelivered);
  const useMailtoFallback = Boolean(hasEmail && canSend && !accountsLoading && !account);

  const title = !hasEmail
    ? "Add an email address on this lead first"
    : accountsLoading
      ? "Checking mailbox…"
      : !canSend || !account
        ? "Connect a mailbox to send from CRM"
        : !fileDelivered
          ? "File Delivered stage is missing"
          : "Email the client — sending moves this card to File Delivered";

  return (
    <div
      className="mt-2"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {useMailtoFallback ? (
        <a
          href={`mailto:${lead.email!.trim()}`}
          className={cn(
            "inline-flex max-w-full items-center gap-1 rounded-full border border-dashed border-line px-2 py-0.5",
            "text-[0.6875rem] font-medium text-ink-muted hover:border-line-strong hover:text-ink",
          )}
          title="Opens your mail app (won't auto-move the card)"
        >
          <Mail className="size-3 shrink-0" aria-hidden />
          <span className="truncate">Email via mail app</span>
        </a>
      ) : (
        <button
          type="button"
          disabled={moveMutation.isPending || accountsLoading}
          title={title}
          onClick={() => {
            if (!ready) {
              toast.message(title);
              return;
            }
            setOpen(true);
          }}
          className={cn(
            "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-left text-[0.6875rem] font-medium",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            ready
              ? "border-brand/35 bg-brand-soft text-brand hover:border-brand/55"
              : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
          )}
          aria-label={title}
        >
          <Mail className="size-3 shrink-0" aria-hidden />
          <span className="truncate">
            {accountsLoading ? "Checking mailbox…" : "Email documents"}
          </span>
        </button>
      )}

      {open && account ? (
        <EmailComposer
          open={open}
          onOpenChange={setOpen}
          account={account}
          context={{
            leadId: lead.id,
            to: lead.email ? [lead.email] : [],
            subject: `Your documents — ${lead.fullName}`,
            mode: "compose",
          }}
          onSent={() => {
            if (fileDelivered) moveMutation.mutate(fileDelivered);
          }}
        />
      ) : null}
    </div>
  );
}
