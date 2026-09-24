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
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

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
