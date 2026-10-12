"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarDays, X, type LucideIcon } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { CONTROL, CONTROL_HEIGHT, type ControlSize } from "@/components/ui/console/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import "react-day-picker/style.css";

const pad = (n: number) => String(n).padStart(2, "0");

/** Parses a `YYYY-MM-DD` calendar date (any time suffix is ignored). */
export function parseLocalDate(value?: string | null): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}

export function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Brand accents for react-day-picker; shared by every calendar popover. */
export const dayPickerClass = "p-3 text-sm [--rdp-accent-background-color:var(--brand-soft)] [--rdp-accent-color:var(--brand)]";

export type PickerAria = {
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  "aria-required"?: React.AriaAttributes["aria-required"];
};

/** Input-styled trigger + popover used by DatePicker and DateTimePicker; the whole field opens it. */
export function PickerShell({
  open,
  onOpenChange,
  icon: Icon,
  display,
  placeholder,
  clearable,
  onClear,
  clearLabel,
  disabled,
  uiSize = "lg",
  className,
  children,
  aria,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  display: string | null;
  placeholder: string;
  clearable?: boolean;
  onClear: () => void;
  clearLabel: string;
  disabled?: boolean;
  uiSize?: ControlSize;
  className?: string;
  children: React.ReactNode;
  aria: PickerAria;
}) {
  const showClear = clearable && display !== null && !disabled;
  return (
    <Popover modal open={open} onOpenChange={onOpenChange}>
      <div className={cn("relative w-full min-w-0", className)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-haspopup="dialog"
            {...aria}
            className={cn(
              CONTROL,
              CONTROL_HEIGHT[uiSize],
              "flex cursor-pointer items-center gap-2 text-left",
              showClear && "pr-9",
            )}
          >
            <Icon aria-hidden className="size-4 shrink-0 text-ink-muted" />
            <span className={cn("min-w-0 flex-1 truncate", display === null && "text-ink-muted")}>
              {display ?? placeholder}
            </span>
          </button>
        </PopoverTrigger>
        {showClear ? (
          <button
            type="button"
            aria-label={clearLabel}
            onClick={onClear}
            className="absolute right-1.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        ) : null}
      </div>
      <PopoverContent align="start" collisionPadding={12} className="w-auto p-0">
        {children}
      </PopoverContent>
    </Popover>
  );
}

export type DatePickerProps = PickerAria & {
  /** `YYYY-MM-DD`, or "" when empty. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** Shows a clear button once a value is set; use for optional fields. */
  clearable?: boolean;
  /** Earliest / latest selectable day, `YYYY-MM-DD`. */
  min?: string;
  max?: string;
  uiSize?: ControlSize;
  className?: string;
};

export function DatePicker({
  value,
  onChange,
  onBlur,
  placeholder = "Pick a date",
  disabled,
  clearable = false,
  min,
  max,
  uiSize = "lg",
  className,
  ...aria
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseLocalDate(value);
  const before = parseLocalDate(min);
  const after = parseLocalDate(max);
  const setOpenAndBlur = (next: boolean) => {
    setOpen(next);
    if (!next) onBlur?.();
  };

  return (
    <PickerShell
      open={open}
      onOpenChange={setOpenAndBlur}
      icon={CalendarDays}
      display={selected ? format(selected, uiSize === "lg" ? "EEE, MMM d, yyyy" : "MMM d, yyyy") : null}
      placeholder={placeholder}
      clearable={clearable}
      onClear={() => onChange("")}
      clearLabel="Clear date"
      disabled={disabled}
      uiSize={uiSize}
      className={className}
      aria={aria}
    >
      <DayPicker
        mode="single"
        selected={selected}
        defaultMonth={selected ?? after ?? before}
        disabled={[...(before ? [{ before }] : []), ...(after ? [{ after }] : [])]}
        onSelect={(day) => {
          if (!day) return;
          onChange(formatLocalDate(day));
          setOpenAndBlur(false);
        }}
        className={dayPickerClass}
      />
    </PickerShell>
  );
}
