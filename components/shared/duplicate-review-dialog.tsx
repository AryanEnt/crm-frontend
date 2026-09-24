"use client";

import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { DuplicateMatch } from "@/lib/api/crm";

export function DuplicateReviewDialog({
  open,
  onOpenChange,
  duplicates,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateMatch[];
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>Potential duplicates found</ModalTitle>
          <ModalDescription>
            Review these matches before continuing. Nothing will be merged or deleted
            automatically.
          </ModalDescription>
        </ModalHeader>
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {duplicates.map((d) => (
            <li
              key={`${d.entity}-${d.id}`}
              className="rounded-md border border-border px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{d.fullName}</p>
                <div className="flex gap-1">
                  <StatusBadge tone="brand">{d.entity}</StatusBadge>
                  <StatusBadge tone="warning">{d.reason}</StatusBadge>
                </div>
              </div>
              <p className="mt-1 text-xs text-foreground-muted">
                {[d.email, d.phone].filter(Boolean).join(" · ") || "No contact details"}
              </p>
            </li>
          ))}
        </ul>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button loading={loading} onClick={onConfirm}>
            Create anyway
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
