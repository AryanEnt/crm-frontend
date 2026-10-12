"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/console/textarea";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const LEAD_LOST_REASONS = [
  "Price",
  "Competitor",
  "Timing",
  "No budget",
  "Went silent",
  "Not a fit",
  "Other",
] as const;

/** One stored string: "Price", "Price: chose a cheaper plan", or just the note for "Other". */
export function composeLostReason(preset: string, note: string): string {
  const n = note.trim();
  if (preset === "Other") return n;
  return n ? `${preset}: ${n}` : preset;
}

export function useLostReasonDraft(open: boolean) {
  const [preset, setPreset] = React.useState<string>(LEAD_LOST_REASONS[0]);
  const [note, setNote] = React.useState("");
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPreset(LEAD_LOST_REASONS[0]);
      setNote("");
    }
  }
  return { preset, note, setPreset, setNote, reason: composeLostReason(preset, note) };
}

export type LostReasonDraft = ReturnType<typeof useLostReasonDraft>;

export function LostReasonFields({ draft }: { draft: LostReasonDraft }) {
  const id = React.useId();
  const noteRequired = draft.preset === "Other";
  return (
    <div className="grid gap-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-reason`} required>
          Reason
        </Label>
        <Select value={draft.preset} onValueChange={draft.setPreset}>
          <SelectTrigger id={`${id}-reason`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_LOST_REASONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-note`} required={noteRequired}>
          {noteRequired ? "What happened?" : "Note (optional)"}
        </Label>
        <Textarea
          id={`${id}-note`}
          rows={3}
          maxLength={400}
          value={draft.note}
          onChange={(e) => draft.setNote(e.target.value)}
          placeholder={noteRequired ? "A short reason" : "Anything worth remembering for next time"}
          autoFocus={noteRequired}
        />
      </div>
    </div>
  );
}

export function LostReasonDialog({
  open,
  leadName,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  leadName: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const draft = useLostReasonDraft(open);
  return (
    <Modal open={open} onOpenChange={(o) => !o && onCancel()}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Mark {leadName || "this lead"} as lost</ModalTitle>
          <ModalDescription>The reason feeds win and loss reporting. The lead stays in your records.</ModalDescription>
        </ModalHeader>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.reason) onConfirm(draft.reason);
          }}
        >
          <LostReasonFields draft={draft} />
          <ModalFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" loading={loading} disabled={!draft.reason}>
              Mark as lost
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
