"use client";

import {
  CircleCheck,
  Info,
  Loader2,
  OctagonX,
  TriangleAlert,
} from "lucide-react";
import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

export function Toaster({ ...props }: ToasterProps) {
  return (
    <SonnerToaster
      position="top-right"
      closeButton
      gap={10}
      duration={4000}
      icons={{
        success: <CircleCheck className="size-4 text-success" />,
        info: <Info className="size-4 text-info" />,
        warning: <TriangleAlert className="size-4 text-warning" />,
        error: <OctagonX className="size-4 text-destructive" />,
        loading: <Loader2 className="size-4 animate-spin text-foreground-muted" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group border border-border bg-surface text-foreground shadow-md rounded-md",
          title: "text-sm font-medium text-foreground",
          description: "text-xs text-foreground-muted",
          actionButton: "bg-primary text-primary-foreground text-xs font-medium",
          cancelButton: "bg-surface-muted text-foreground-muted text-xs font-medium",
          closeButton:
            "border-border bg-surface text-foreground-muted hover:bg-surface-muted",
        },
      }}
      {...props}
    />
  );
}
