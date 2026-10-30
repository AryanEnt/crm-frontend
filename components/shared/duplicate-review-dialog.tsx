"use client";

import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { DuplicateMatchList } from "@/components/shared/duplicate-match-list";
import type { DuplicateMatch } from "@/lib/api/crm";

export function DuplicateReviewDialog({
  open,
  onOpenChange,
  duplicates,
  onConfirm,
  loading,
  confirmLabel = "Create anyway",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateMatch[];
  onConfirm: () => void;
  loading?: boolean;
  confirmLabel?: string;
}) {
  const first = duplicates[0];
  const titleName = first?.fullName?.trim() || "This person";

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle>Already in your CRM?</ModalTitle>
          <ModalDescription>
            <span className="font-medium text-foreground">{titleName}</span> looks similar to{" "}
            {duplicates.length === 1 ? "someone you already have" : "people you already have"}. Check
            before creating a duplicate — you can still continue if this is a different person.
          </ModalDescription>
        </ModalHeader>
        <DuplicateMatchList matches={duplicates} />
        <ModalFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Keep editing
          </Button>
          <Button
            variant="ghost"
            loading={loading}
            onClick={onConfirm}
            className="w-full text-foreground-muted sm:w-auto"
          >
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
