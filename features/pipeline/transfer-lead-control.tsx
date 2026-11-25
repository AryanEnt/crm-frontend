"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-provider";
import { adminApi } from "@/lib/api/admin";
import { crmApi, type LeadBoardCard } from "@/lib/api/crm";
import { cn } from "@/lib/utils";

/** Lost stage, Team Leads only: hand the lead to another team executive as a fresh lead. */
export function TransferLeadControl({ lead }: { lead: LeadBoardCard }) {
  const { user } = useAuth();
  const isTeamLead = user?.roleCode === "sales_manager";
  const [open, setOpen] = React.useState(false);

  if (lead.transferredToLeadId) {
    return (
      <div className="mt-2">
        <span
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-success/40 bg-success-soft px-2 py-0.5 text-[0.6875rem] font-medium text-success"
          title="Transferred as a new lead"
        >
          <CheckCircle2 className="size-3 shrink-0" aria-hidden />
          <span className="truncate">Transferred to {lead.transferredToOwnerName?.trim() || "another executive"}</span>
        </span>
      </div>
    );
  }
  if (!isTeamLead) return null;

  return (
    <div
      className="mt-2"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-left text-[0.6875rem] font-medium",
          "border-brand/35 bg-brand-soft text-brand hover:border-brand/55",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <ArrowRightLeft className="size-3 shrink-0" aria-hidden />
        <span className="truncate">Transfer Lead</span>
      </button>
      {open ? <TransferLeadDialog lead={lead} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function TransferLeadDialog({ lead, onClose }: { lead: LeadBoardCard; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const teamId = user?.teamIds?.[0];
  const [ownerUserId, setOwnerUserId] = React.useState("");

  const membersQuery = useQuery({
    queryKey: ["team-members", "se", teamId],
    enabled: !!teamId,
    queryFn: () => {
      const params = new URLSearchParams({ limit: "100", isActive: "true", roleCode: "sales_executive" });
      if (teamId) params.set("teamId", teamId);
      return adminApi.listUsers(params);
    },
  });
  const executives = (membersQuery.data?.data ?? []).filter((m) => m.id !== lead.ownerUserId);
  const selected = executives.find((m) => m.id === ownerUserId);

  const transfer = useMutation({
    mutationFn: () => crmApi.transferLead(lead.id, ownerUserId),
    onSuccess: () => {
      toast.success("Lead transferred", {
        description: `${lead.fullName} is now a new lead for ${selected?.fullName ?? "the executive"}`,
      });
      void qc.invalidateQueries({ queryKey: ["lead-board"] });
      void qc.invalidateQueries({ queryKey: ["leads"] });
      onClose();
    },
    onError: (err) => {
      toast.error("Couldn't transfer lead", {
        description: err instanceof Error && err.message ? err.message : undefined,
      });
    },
  });

  return (
    <Modal open onOpenChange={(o) => !o && onClose()}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Transfer {lead.fullName || "this lead"}</ModalTitle>
          <ModalDescription>
            The selected executive gets this as a new lead in the first stage of the Lead Pipeline, with the stage clock
            starting today. Contact and profile details are kept. This Lost lead stays as the record of the loss.
          </ModalDescription>
        </ModalHeader>
        <div className="space-y-1.5">
          <Label htmlFor="transfer-lead-owner">Executive</Label>
          <Select value={ownerUserId} onValueChange={setOwnerUserId} disabled={membersQuery.isLoading}>
            <SelectTrigger id="transfer-lead-owner" className="h-10">
              <SelectValue placeholder={membersQuery.isLoading ? "Loading team…" : "Select an executive"} />
            </SelectTrigger>
            <SelectContent>
              {executives.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!membersQuery.isLoading && executives.length === 0 ? (
            <p className="text-caption text-ink-muted">No other active executives on your team.</p>
          ) : null}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={transfer.isPending} disabled={!ownerUserId} onClick={() => transfer.mutate()}>
            Transfer lead
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
