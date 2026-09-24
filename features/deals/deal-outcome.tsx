"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Pipeline, PipelineStage } from "@/lib/api/crm";

export const LOST_REASONS = [
  "Price",
  "Competitor",
  "Timing",
  "No budget",
  "Went silent",
  "Not a fit",
  "Other",
] as const;

export function findOutcomeStage(pipeline: Pipeline | null | undefined, kind: "won" | "lost") {
  const stages = (pipeline?.stages ?? []).filter((s) => s.isActive);
  return stages.find((s) => (kind === "won" ? s.isWon : s.isLost)) ?? null;
}

export function stageById(pipeline: Pipeline | null | undefined, stageId?: string | null) {
  if (!stageId) return null;
  return pipeline?.stages.find((s) => s.id === stageId) ?? null;
}

export type LostReasonState = {
  dealId: string;
  stageId: string;
  stageName?: string;
  force?: boolean;
} | null;

export function LostReasonDialog({
  pending,
  loading,
  onCancel,
  onConfirm,
}: {
  pending: LostReasonState;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [preset, setPreset] = React.useState<string>(LOST_REASONS[0]);
  const [other, setOther] = React.useState("");

  React.useEffect(() => {
    if (!pending) return;
    setPreset(LOST_REASONS[0]);
    setOther("");
  }, [pending]);

  const reason = preset === "Other" ? other.trim() : preset;

  return (
    <Modal open={!!pending} onOpenChange={(o) => !o && onCancel()}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Mark as lost</ModalTitle>
          <ModalDescription>
            Why did {pending?.stageName ? `this deal move to ${pending.stageName}` : "this deal"} not close?
          </ModalDescription>
        </ModalHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label required>Lost reason</Label>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {preset === "Other" ? (
            <div className="space-y-1.5">
              <Label required>Details</Label>
              <Input
                value={other}
                onChange={(e) => setOther(e.target.value)}
                placeholder="Short reason"
                autoFocus
              />
            </div>
          ) : null}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={loading}
            disabled={!reason}
            onClick={() => onConfirm(reason)}
          >
            Mark lost
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function DealOutcomeButtons({
  status,
  canEdit,
  wonStage,
  lostStage,
  onWon,
  onLost,
  size = "sm",
}: {
  status: string;
  canEdit: boolean;
  wonStage: PipelineStage | null;
  lostStage: PipelineStage | null;
  onWon: () => void;
  onLost: () => void;
  size?: "sm" | "icon-sm";
}) {
  if (!canEdit || status === "archived") return null;
  const isWon = status === "won";
  const isLost = status === "lost";
  return (
    <div className="flex items-center gap-1.5">
      <Button
        size={size}
        disabled={!wonStage || isWon}
        className="bg-success text-white hover:bg-success/90"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onWon();
        }}
      >
        Won
      </Button>
      <Button
        size={size}
        variant="destructive"
        disabled={!lostStage || isLost}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onLost();
        }}
      >
        Lost
      </Button>
    </div>
  );
}
