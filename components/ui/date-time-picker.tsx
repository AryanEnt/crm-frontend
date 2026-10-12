"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarClock } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { toDateTimeLocal } from "@/lib/forms/datetime";
import type { ControlSize } from "@/components/ui/console/input";
import { dayPickerClass, PickerShell, type PickerAria } from "@/components/ui/date-picker";

/** Parses the `YYYY-MM-DDTHH:mm` wall-clock value used by datetime-local inputs. */
export function parseLocalDateTime(value?: string | null): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value ?? "");
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
}

const at = (day: Date, minutes: number) =>
  toDateTimeLocal(new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60));

const slotLabel = (minutes: number) => format(new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60), "h:mm a");

export type DateTimePickerProps = PickerAria & {
  /** `YYYY-MM-DDTHH:mm` wall-clock value, or "" when empty. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** Shows a clear button once a value is set; use for optional fields. */
  clearable?: boolean;
  minuteStep?: number;
  /** Time used when a day is picked before any time, in minutes after midnight. */
  defaultMinutes?: number;
  uiSize?: ControlSize;
  className?: string;
};

/** Date + time in one field: the whole control opens a calendar beside a time list. */
export function DateTimePicker({
  value,
  onChange,
  onBlur,
  placeholder = "Pick a date and time",
  disabled,
  clearable = false,
  minuteStep = 15,
  defaultMinutes = 9 * 60,
  uiSize = "lg",
  className,
  ...aria
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const selected = parseLocalDateTime(value);
  const minutes = selected ? selected.getHours() * 60 + selected.getMinutes() : null;

  const slots = React.useMemo(() => {
    const list: number[] = [];
    for (let m = 0; m < 24 * 60; m += minuteStep) list.push(m);
    if (minutes !== null && !list.includes(minutes)) list.push(minutes);
    return list.sort((a, b) => a - b);
  }, [minuteStep, minutes]);

  React.useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const target =
        listRef.current?.querySelector('[aria-selected="true"]') ??
        listRef.current?.querySelector(`[data-minutes="${defaultMinutes}"]`);
      target?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, defaultMinutes]);

  const setOpenAndBlur = (next: boolean) => {
    setOpen(next);
    if (!next) onBlur?.();
  };

  return (
    <PickerShell
      open={open}
      onOpenChange={setOpenAndBlur}
      icon={CalendarClock}
      display={
        selected ? format(selected, uiSize === "lg" ? "EEE, MMM d, yyyy 'at' h:mm a" : "MMM d, yyyy, h:mm a") : null
      }
      placeholder={placeholder}
      clearable={clearable}
      onClear={() => onChange("")}
      clearLabel="Clear date and time"
      disabled={disabled}
      uiSize={uiSize}
      className={className}
      aria={aria}
    >
      <div className="flex items-stretch">
        <DayPicker
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(day) => day && onChange(at(day, minutes ?? defaultMinutes))}
          className={dayPickerClass}
        />
        <div className="relative w-28 border-l border-line">
          <p className="border-b border-line px-3 py-2 text-caption font-medium text-ink-secondary">Time</p>
          <div
            ref={listRef}
            role="listbox"
            aria-label="Time"
            className="crm-scroll absolute inset-x-0 bottom-0 top-[33px] overflow-y-auto p-1"
          >
            {slots.map((m) => {
              const active = m === minutes;
              return (
                <button
                  key={m}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-minutes={m}
                  onClick={() => {
                    onChange(at(selected ?? new Date(), m));
                    setOpenAndBlur(false);
                  }}
                  className={cn(
                    "flex h-7 w-full items-center rounded-md px-2 text-left text-caption tabular-nums transition-colors",
                    active ? "bg-brand text-primary-foreground" : "text-ink hover:bg-surface-muted",
                  )}
                >
                  {slotLabel(m)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </PickerShell>
  );
}
