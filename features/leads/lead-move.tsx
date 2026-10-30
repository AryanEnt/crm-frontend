"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import {
  crmApi,
  type LeadClosedError,
  type LeadMoveResult,
  type StageMoveError,
} from "@/lib/api/crm";
import { ApiError } from "@/types/api";
import { classifyMove, isNurturingPipeline } from "@/features/leads/lead-board-state";
import {
  LostReasonDialog,
  LostReasonFields,
  useLostReasonDraft,
} from "@/features/leads/lost-reason-dialog";

export { LEAD_LOST_REASONS } from "@/features/leads/lost-reason-dialog";

export type MoveTarget = {
  id: string;
  name: string;
  isWon: boolean;
  isLost: boolean;
};

export type LeadMoveRequest = {
  leadId: string;
  leadName: string;
  /** Current lead status; won/lost need an explicit reopen. */
  status: string;
  fromStageId: string | null;
  to: MoveTarget;
  pipelineId?: string;
  /** Already-captured reason; when set, moving to Lost skips the prompt. */
  lostReason?: string | null;
  /** Already-captured YYYY-MM-DD; when set, moving to Won skips the prompt. */
  documentDeadline?: string | null;
  /** Already-captured closed value; when set with a deadline, moving to Won skips the prompt. */
  closingAmount?: number | null;
};

type MoveVars = Omit<LeadMoveRequest, "lostReason" | "documentDeadline" | "closingAmount"> & {
  force?: boolean;
  reopen?: boolean;
  lostReason?: string;
  documentDeadline?: string;
  closingAmount?: number;
};

type Pending =
  | { kind: "lost"; req: MoveVars }
  | { kind: "won"; req: MoveVars }
  | { kind: "reopen"; req: MoveVars; needsReason: boolean }
  | { kind: "blocked"; vars: MoveVars; details: StageMoveError }
  | null;

function isStageMoveError(details: unknown): details is StageMoveError {
  if (!details || typeof details !== "object") return false;
  const d = details as StageMoveError;
  return Array.isArray(d.missingFields) || Array.isArray(d.missingActivities) || Array.isArray(d.missingDocuments);
}

function isLeadClosedError(details: unknown): details is LeadClosedError {
  return !!details && typeof details === "object" && (details as LeadClosedError).reason === "lead_closed";
}

/**
 * The one stage-move flow for Leads: lost reason, Won document deadline, reopen
 * confirmation, and stage requirements. Callers own optimistic UI through
 * `onOptimistic`, which returns a rollback.
 */
export function useLeadMove({
  onOptimistic,
  onMoved,
  onChanged,
}: {
  onOptimistic?: (vars: MoveVars) => (() => void) | void;
  onMoved?: (result: LeadMoveResult, vars: MoveVars) => void;
  /** After every settled move; refresh server data here. */
  onChanged?: (leadId: string) => void;
} = {}) {
  const [pending, setPending] = React.useState<Pending>(null);
  const [announce, setAnnounce] = React.useState("");

  const mutation = useMutation({
    mutationFn: (vars: MoveVars) =>
      crmApi.moveLead(vars.leadId, {
        stageId: vars.to.id,
        pipelineId: vars.pipelineId,
        force: vars.force,
        reopen: vars.reopen,
        lostReason: vars.lostReason,
        documentDeadline: vars.documentDeadline,
        closingAmount: vars.closingAmount,
      }),
    onMutate: (vars) => ({ rollback: onOptimistic?.(vars) ?? undefined }),
    onSuccess: (result, vars) => {
      setPending(null);
      if (vars.to.isWon) {
        if (isNurturingPipeline(vars.pipelineId)) {
          toast.success("Nurturing complete", { description: vars.leadName });
          setAnnounce(`${vars.leadName} marked complete in Nurturing`);
        } else {
          toast.success("Lead marked as won — moved to Nurturing", { description: vars.leadName });
          setAnnounce(`${vars.leadName} marked as won and moved to Nurturing`);
        }
      } else if (vars.to.isLost) {
        toast.success("Lead marked as lost", { description: vars.leadName });
        setAnnounce(`${vars.leadName} marked as lost`);
      } else {
        toast.success(vars.reopen ? `Lead reopened in ${vars.to.name}` : `Lead moved to ${vars.to.name}`, {
          description: vars.leadName,
        });
        setAnnounce(`${vars.leadName} moved to ${vars.to.name}`);
      }
      onMoved?.(result, vars);
    },
    onError: (err, vars, ctx) => {
      ctx?.rollback?.();
      if (err instanceof ApiError && err.status === 400 && isStageMoveError(err.details)) {
        if (
          (err.details as StageMoveError).reason === "document_deadline_required" ||
          (err.details as StageMoveError).reason === "closing_amount_required"
        ) {
          setPending({ kind: "won", req: vars });
          setAnnounce("Enter the closing amount and document send deadline to mark as won.");
          return;
        }
        setPending({ kind: "blocked", vars, details: err.details });
        setAnnounce("Stage move blocked. Review the requirements.");
        return;
      }
      if (err instanceof ApiError && err.status === 400 && isLeadClosedError(err.details)) {
        setPending({ kind: "reopen", req: vars, needsReason: vars.to.isLost });
        return;
      }
      setPending(null);
      toast.error("Couldn't move the lead. The change was undone.", {
        description: err instanceof Error && err.message ? err.message : "Try again in a moment.",
      });
      setAnnounce("Move failed and was undone.");
    },
    onSettled: (_data, _err, vars) => onChanged?.(vars.leadId),
  });

  const request = React.useCallback(
    ({ lostReason: captured, documentDeadline: deadline, closingAmount: amount, ...req }: LeadMoveRequest) => {
      const known = captured?.trim() || undefined;
      const knownDeadline = deadline?.trim() || undefined;
      const knownAmount = amount != null && Number.isFinite(amount) && amount >= 0 && Number.isInteger(amount) ? amount : undefined;
      const intent = classifyMove({ stageId: req.fromStageId, status: req.status }, req.to, {
        pipelineId: req.pipelineId,
      });
      switch (intent.kind) {
        case "noop":
          return;
        case "lost_reason":
          if (known) mutation.mutate({ ...req, lostReason: known });
          else setPending({ kind: "lost", req });
          return;
        case "won_deadline":
          if (knownDeadline && knownAmount != null) {
            mutation.mutate({ ...req, documentDeadline: knownDeadline, closingAmount: knownAmount });
          } else setPending({ kind: "won", req: { ...req, closingAmount: knownAmount } });
          return;
        case "reopen":
          setPending({ kind: "reopen", req: { ...req, lostReason: known }, needsReason: intent.lostReason && !known });
          return;
        default:
          mutation.mutate(req);
      }
    },
    [mutation],
  );

  const dialogs = (
    <>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </div>
      <LostReasonDialog
        open={pending?.kind === "lost"}
        leadName={pending?.kind === "lost" ? pending.req.leadName : ""}
        loading={mutation.isPending}
        onCancel={() => setPending(null)}
        onConfirm={(lostReason) => pending?.kind === "lost" && mutation.mutate({ ...pending.req, lostReason })}
      />
      <WonDeadlineDialog
        open={pending?.kind === "won"}
        leadName={pending?.kind === "won" ? pending.req.leadName : ""}
        initialAmount={pending?.kind === "won" ? pending.req.closingAmount : undefined}
        loading={mutation.isPending}
        onCancel={() => setPending(null)}
        onConfirm={(documentDeadline, closingAmount) =>
          pending?.kind === "won" && mutation.mutate({ ...pending.req, documentDeadline, closingAmount })
        }
      />
      <ReopenModal
        open={pending?.kind === "reopen"}
        leadName={pending?.kind === "reopen" ? pending.req.leadName : ""}
        status={pending?.kind === "reopen" ? pending.req.status : ""}
        stageName={pending?.kind === "reopen" ? pending.req.to.name : ""}
        needsReason={pending?.kind === "reopen" && pending.needsReason}
        loading={mutation.isPending}
        onCancel={() => setPending(null)}
        onConfirm={(lostReason) =>
          pending?.kind === "reopen" &&
          mutation.mutate({ ...pending.req, reopen: true, lostReason: lostReason ?? pending.req.lostReason })
        }
      />
      <RequirementsModal
        details={pending?.kind === "blocked" ? pending.details : null}
        loading={mutation.isPending}
        onCancel={() => setPending(null)}
        onForce={() => pending?.kind === "blocked" && mutation.mutate({ ...pending.vars, force: true })}
      />
    </>
  );

  return { request, dialogs, isPending: mutation.isPending };
}

function WonDeadlineDialog({
  open,
  leadName,
  initialAmount,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  leadName: string;
  initialAmount?: number;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (documentDeadline: string, closingAmount: number) => void;
}) {
  const [deadline, setDeadline] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDeadline("");
      setAmount(initialAmount != null ? String(initialAmount) : "");
    }
  }
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const parsed = amount.trim() === "" ? null : Number(amount.trim());
  const amountOk = parsed != null && Number.isInteger(parsed) && parsed >= 0;
  return (
    <Modal open={open} onOpenChange={(o) => !o && onCancel()}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Close deal for {leadName || "this lead"}</ModalTitle>
          <ModalDescription>
            Enter the closing amount, then choose when documents must be sent. We&apos;ll move the lead into Nurturing
            and track that send-by date there.
          </ModalDescription>
        </ModalHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="closing-amount" required>
              Closing amount
            </Label>
            <Input
              id="closing-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="e.g. 25000"
              autoFocus={!amount}
            />
          </div>
          <div className="space-y-1.5">
            <Label required>Send documents by</Label>
            <DatePicker value={deadline} onChange={setDeadline} min={today} placeholder="Pick a send-by date" />
            <p className="text-meta text-ink-muted">Shown on the Nurturing board so the team can chase on time.</p>
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            loading={loading}
            disabled={!deadline || !amountOk}
            onClick={() => amountOk && onConfirm(deadline, parsed)}
          >
            Deal Close — move to Nurturing
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function ReopenModal({
  open,
  leadName,
  status,
  stageName,
  needsReason,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  leadName: string;
  status: string;
  stageName: string;
  needsReason: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (lostReason?: string) => void;
}) {
  const r = useLostReasonDraft(open);
  const closedAs = status === "won" ? "Won" : "Lost";
  return (
    <Modal open={open} onOpenChange={(o) => !o && onCancel()}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Reopen {leadName || "this lead"}?</ModalTitle>
          <ModalDescription>
            This lead is closed as {closedAs}. Moving it to {stageName} reopens it and is recorded in its history. For a
            repeat purchase, create a new lead instead.
          </ModalDescription>
        </ModalHeader>
        {needsReason ? <LostReasonFields draft={r} /> : null}
        <ModalFooter>
          <Button variant="outline" onClick={onCancel}>
            Keep closed
          </Button>
          <Button
            loading={loading}
            disabled={needsReason && !r.reason}
            onClick={() => onConfirm(needsReason ? r.reason : undefined)}
          >
            Reopen and move
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function RequirementsModal({
  details,
  loading,
  onCancel,
  onForce,
}: {
  details: StageMoveError | null;
  loading: boolean;
  onCancel: () => void;
  onForce: () => void;
}) {
  const items = [
    ...(details?.missingFields ?? []).map((f) => ({ key: `f-${f}`, label: "Field", value: f })),
    ...(details?.missingActivities ?? []).map((a) => ({ key: `a-${a}`, label: "Activity", value: a })),
    ...(details?.missingDocuments ?? []).map((d) => ({ key: `d-${d}`, label: "Document", value: d })),
  ];
  return (
    <Modal open={!!details} onOpenChange={(o) => !o && onCancel()}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Before moving to {details?.stageName ?? "this stage"}</ModalTitle>
          <ModalDescription>This stage expects a few things first. Complete them, or move anyway.</ModalDescription>
        </ModalHeader>
        <ul className="space-y-1.5 text-sm">
          {items.map((i) => (
            <li key={i.key} className="flex items-baseline gap-2">
              <span className="w-16 shrink-0 text-meta">{i.label}</span>
              <span className="font-medium text-ink">{i.value.replace(/_/g, " ")}</span>
            </li>
          ))}
        </ul>
        <ModalFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button loading={loading} onClick={onForce}>
            Move anyway
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
