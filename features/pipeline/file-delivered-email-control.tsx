"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Mail } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/auth-provider";
import { EmailComposer } from "@/features/email/email-composer";
import { emailApi } from "@/lib/api/email";
import { crmApi, type LeadBoard, type LeadBoardCard } from "@/lib/api/crm";
import { cn } from "@/lib/utils";

function patchBoardCard(
  board: LeadBoard | undefined,
  leadId: string,
  patch: Pick<LeadBoardCard, "fileDeliveredEmailSentAt">,
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

/** File Delivered-stage email: send the document email without leaving the stage. */
export function FileDeliveredEmailControl({
  lead,
  canEdit,
}: {
  lead: LeadBoardCard;
  canEdit: boolean;
}) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const canSend = can("email:send");
  const alreadySent = Boolean(lead.fileDeliveredEmailSentAt);

  const accountsQuery = useQuery({
    queryKey: ["email-accounts"],
    queryFn: () => emailApi.listAccounts(),
    enabled: canSend || can("email:view"),
  });
  const accountsLoading = accountsQuery.isLoading || accountsQuery.isFetching;
  const account = accountsQuery.data?.accounts?.[0] ?? null;

  const markSent = useMutation({
    mutationFn: () => crmApi.markFileDeliveredEmailSent(lead.id),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["lead-board"] });
      const previous = qc.getQueriesData<LeadBoard>({ queryKey: ["lead-board"] });
      const at = new Date().toISOString();
      qc.setQueriesData<LeadBoard>({ queryKey: ["lead-board"] }, (board) =>
        patchBoardCard(board, lead.id, { fileDeliveredEmailSentAt: at }),
      );
      return { previous };
    },
    onError: (err, _v, ctx) => {
      for (const [key, data] of ctx?.previous ?? []) qc.setQueryData(key, data);
      toast.error("Email sent, but couldn't update the lead status", {
        description: err instanceof Error && err.message ? err.message : undefined,
      });
    },
    onSuccess: () => {
      toast.success("Email sent", { description: `${lead.fullName} marked as emailed` });
      void qc.invalidateQueries({ queryKey: ["lead-board"] });
      void qc.invalidateQueries({ queryKey: ["lead", lead.id] });
      void qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  if (!canEdit && !alreadySent) return null;

  const hasEmail = Boolean(lead.email?.trim());
  const ready = Boolean(account && canSend && hasEmail && !alreadySent);

  if (alreadySent) {
    return (
      <div
        className="mt-2"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <span
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-success/40 bg-success-soft px-2 py-0.5 text-[0.6875rem] font-medium text-success"
          title="Document email already sent — overdue count stopped"
        >
          <CheckCircle2 className="size-3 shrink-0" aria-hidden />
          <span className="truncate">Email sent</span>
        </span>
      </div>
    );
  }

  const title = !hasEmail
    ? "Add an email address on this lead first"
    : accountsLoading
      ? "Checking mailbox…"
      : !canSend || !account
        ? "Connect a mailbox to send from CRM"
        : "Send the document email from File Delivered";

  return (
    <div
      className="mt-2"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={markSent.isPending || accountsLoading}
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
        <span className="truncate">{accountsLoading ? "Checking mailbox…" : "Email Document"}</span>
      </button>

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
            markSent.mutate();
          }}
        />
      ) : null}
    </div>
  );
}
