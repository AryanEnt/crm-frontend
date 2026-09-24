"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FormSummaryAction = {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost";
};

export function FormSummary({
  title = "Created successfully",
  headline,
  details,
  actions,
  className,
}: {
  title?: string;
  headline: string;
  details?: string[];
  actions?: FormSummaryAction[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-5", className)}>
      <div className="space-y-1">
        <p className="text-[12px] font-medium text-success">{title}</p>
        <p className="text-[15px] font-semibold tracking-tight text-foreground">{headline}</p>
        {details && details.length > 0 ? (
          <p className="text-[13px] text-foreground-muted">
            {details.filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>
      {actions && actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button
              key={a.label}
              type="button"
              variant={a.variant ?? "outline"}
              size="sm"
              onClick={a.onClick}
            >
              {a.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
