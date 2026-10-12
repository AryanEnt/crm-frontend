"use client";

import * as React from "react";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent, ModalDescription, ModalTitle } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { DraftIndicator } from "./draft-indicator";

export function QuickCreateDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Wider drawer for guided create */
  wide?: boolean;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          "max-w-full bg-surface",
          wide ? "sm:max-w-lg md:max-w-[32rem]" : "sm:max-w-[26rem]",
          className,
        )}
      >
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          {description ? <DrawerDescription>{description}</DrawerDescription> : null}
          <DraftIndicator className="pt-0.5" />
        </DrawerHeader>
        <DrawerBody>{children}</DrawerBody>
        {footer ? <DrawerFooter>{footer}</DrawerFooter> : null}
      </DrawerContent>
    </Drawer>
  );
}

/** Centred alternative to QuickCreateDrawer: sizes to its content and scrolls the body past 85vh. */
export function QuickCreateDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className={cn("flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-[480px]", className)}>
        <div className="shrink-0 space-y-0.5 border-b border-line px-5 pb-3.5 pt-4 pr-12">
          <ModalTitle>{title}</ModalTitle>
          {description ? (
            <ModalDescription className="text-[12.5px] leading-snug">{description}</ModalDescription>
          ) : null}
          <DraftIndicator className="pt-0.5" />
        </div>
        <div className="crm-scroll min-h-0 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
        ) : null}
      </ModalContent>
    </Modal>
  );
}

export function QuickCreateDrawerFooter({
  onCancel,
  submitLabel,
  loading,
  secondaryLabel,
  onSecondary,
  children,
}: {
  onCancel: () => void;
  submitLabel: string;
  loading?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-2">
      {children}
      <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
        Cancel
      </Button>
      {secondaryLabel && onSecondary ? (
        <Button
          type="button"
          variant="outline"
          onClick={onSecondary}
          disabled={loading}
          loading={loading}
        >
          {secondaryLabel}
        </Button>
      ) : null}
      <Button type="submit" loading={loading}>
        {submitLabel}
      </Button>
    </div>
  );
}
