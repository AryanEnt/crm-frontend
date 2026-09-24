"use client";

import * as React from "react";
import type { FieldValues, UseFormReturn, Path } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";

const DRAFT_PREFIX = "crm-form-draft:";

type UseFormDraftOptions<T extends FieldValues> = {
  form: UseFormReturn<T>;
  draftKey?: string;
  enabled?: boolean;
  debounceMs?: number;
};

export function useFormDraft<T extends FieldValues>({
  form,
  draftKey,
  enabled = true,
  debounceMs = 800,
}: UseFormDraftOptions<T>) {
  const [lastDraftSavedAt, setLastDraftSavedAt] = React.useState<number | null>(null);
  const [isDirtyDraft, setIsDirtyDraft] = React.useState(false);
  const [pendingRestore, setPendingRestore] = React.useState<T | null>(null);
  const [promptOpen, setPromptOpen] = React.useState(false);
  const restoredRef = React.useRef(false);

  const storageKey = draftKey ? `${DRAFT_PREFIX}${draftKey}` : null;

  React.useEffect(() => {
    if (!enabled || !storageKey || restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { values: T; savedAt: number };
      if (!parsed?.values) return;
      setPendingRestore(parsed.values);
      setLastDraftSavedAt(parsed.savedAt);
      setPromptOpen(true);
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [enabled, storageKey]);

  React.useEffect(() => {
    if (!enabled || !storageKey) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = form.watch((values) => {
      setIsDirtyDraft(true);
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const savedAt = Date.now();
          localStorage.setItem(storageKey, JSON.stringify({ values, savedAt }));
          setLastDraftSavedAt(savedAt);
        } catch {
          /* quota / private mode */
        }
      }, debounceMs);
    });
    return () => {
      clearTimeout(timer);
      sub.unsubscribe();
    };
  }, [enabled, storageKey, form, debounceMs]);

  const clearDraft = React.useCallback(() => {
    if (storageKey) localStorage.removeItem(storageKey);
    setIsDirtyDraft(false);
    setLastDraftSavedAt(null);
  }, [storageKey]);

  const restorePrompt =
    promptOpen && pendingRestore ? (
      <Modal open={promptOpen} onOpenChange={setPromptOpen}>
        <ModalContent className="max-w-sm">
          <ModalHeader>
            <ModalTitle>Continue unfinished draft?</ModalTitle>
            <ModalDescription>
              {lastDraftSavedAt
                ? `Last edited ${formatRelative(lastDraftSavedAt)}.`
                : "You have unsaved form data."}
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => {
                clearDraft();
                setPendingRestore(null);
                setPromptOpen(false);
              }}
            >
              Discard
            </Button>
            <Button
              onClick={() => {
                form.reset(pendingRestore);
                setPendingRestore(null);
                setPromptOpen(false);
                setIsDirtyDraft(true);
              }}
            >
              Continue
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    ) : null;

  return { isDirtyDraft, lastDraftSavedAt, clearDraft, restorePrompt };
}

function formatRelative(ts: number) {
  const seconds = Math.round((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} day(s) ago`;
}

/** Clear a draft by key (e.g. after successful create). */
export function clearFormDraft(draftKey: string) {
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${draftKey}`);
  } catch {
    /* ignore */
  }
}

/** Read a nested path from form values for conditional rules. */
export function getPathValue<T extends FieldValues>(values: T, path: Path<T>): unknown {
  const parts = String(path).split(".");
  let cur: unknown = values;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}
