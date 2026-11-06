"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { Textarea } from "@/components/ui/console/textarea";
import { cn } from "@/lib/utils";
import { CONTACT_RATING_MAX, contactRemarksProblem } from "./contact-rating";

export function contactRatingReady(rating: number, remarks: string): boolean {
  return rating >= 1 && contactRemarksProblem(remarks) == null;
}

export function StarRow({
  value,
  onChange,
  disabled,
  size = "md",
}: {
  value: number;
  onChange?: (n: number) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const starClass = size === "sm" ? "size-4" : "size-5";
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Star rating">
      {Array.from({ length: CONTACT_RATING_MAX }, (_, i) => {
        const n = i + 1;
        const on = n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            disabled={disabled || !onChange}
            onClick={() => onChange?.(n)}
            className={cn(
              "rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              onChange && !disabled ? "hover:scale-105" : "cursor-default",
            )}
          >
            <Star
              className={cn(starClass, on ? "fill-warning text-warning" : "text-ink-muted")}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}

/** Presentational stars + remarks used by the board popover and the move dialog. */
export function ContactRatingFields({
  rating,
  remarks,
  onRatingChange,
  onRemarksChange,
  disabled,
  remarksId,
  starSize = "md",
}: {
  rating: number;
  remarks: string;
  onRatingChange: (n: number) => void;
  onRemarksChange: (value: string) => void;
  disabled?: boolean;
  remarksId: string;
  starSize?: "sm" | "md";
}) {
  const remarksError = rating >= 1 ? contactRemarksProblem(remarks) : null;

  return (
    <div className="space-y-3">
      <StarRow value={rating} onChange={onRatingChange} disabled={disabled} size={starSize} />
      <div className="space-y-1.5">
        <label className="block text-caption font-medium text-ink" htmlFor={remarksId}>
          Remarks <span className="text-danger">*</span>
        </label>
        <Textarea
          id={remarksId}
          rows={3}
          maxLength={1000}
          value={remarks}
          onChange={(e) => onRemarksChange(e.target.value)}
          placeholder="At least 5 different words"
          disabled={disabled}
          className="min-h-[72px] text-sm"
        />
        {remarksError && remarks.trim() ? (
          <p className="text-caption text-danger" role="alert">
            {remarksError}
          </p>
        ) : (
          <p className="text-caption text-ink-muted">Min. 5 different words — repeats don’t count.</p>
        )}
      </div>
    </div>
  );
}
