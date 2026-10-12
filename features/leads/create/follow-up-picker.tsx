"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CHIP, CHIP_ACTIVE, CHIP_IDLE, FIELD_CONTROL, type FieldA11y, useRovingRadio } from "./field-ui";
import {
  FOLLOW_UP_PRESETS,
  atDefaultHour,
  formatFollowUp,
  fromLocalInput,
  matchPreset,
  nowInZone,
  resolveFollowUp,
  toLocalInput,
  withTime,
  type FollowUpPreset,
} from "./follow-up";

type Choice = FollowUpPreset | "pick";
const CHOICES: readonly Choice[] = [...FOLLOW_UP_PRESETS.map((p) => p.value), "pick"];
const LABELS: Record<Choice, string> = {
  ...(Object.fromEntries(FOLLOW_UP_PRESETS.map((p) => [p.value, p.label])) as Record<FollowUpPreset, string>),
  pick: "Pick date",
};

export function FollowUpPicker({
  value,
  onChange,
  timeZone,
  a11y,
  labelId,
}: {
  /** "YYYY-MM-DDTHH:mm" wall-clock time in `timeZone`, or "". */
  value: string;
  onChange: (value: string) => void;
  timeZone?: string;
  a11y: FieldA11y;
  labelId: string;
}) {
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const now = nowInZone(timeZone);
  const preset = matchPreset(value, now);
  const selected: Choice | null = value ? (preset ?? "pick") : null;
  const date = fromLocalInput(value);
  const time = date ? toLocalInput(date).slice(11) : "";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const choose = (choice: Choice) => {
    if (choice === "pick") {
      setCalendarOpen(true);
      return;
    }
    const next = resolveFollowUp(choice, now);
    // Keep a time the user already adjusted when they switch between shortcuts.
    onChange(time && time !== "09:00" ? withTime(toLocalInput(next), time) : toLocalInput(next));
  };
  const radio = useRovingRadio(CHOICES, selected, (c) => (c === "pick" ? undefined : choose(c)));

  return (
    <div className="flex flex-col gap-2">
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverAnchor asChild>
          <div
            role="radiogroup"
            aria-labelledby={labelId}
            aria-describedby={a11y["aria-describedby"]}
            className="flex flex-wrap gap-1.5"
          >
            {CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                {...radio(choice)}
                onClick={() => choose(choice)}
                className={cn(CHIP, selected === choice ? CHIP_ACTIVE : CHIP_IDLE)}
              >
                {choice === "pick" ? <CalendarDays aria-hidden className="size-3.5" /> : null}
                {LABELS[choice]}
              </button>
            ))}
          </div>
        </PopoverAnchor>
        <PopoverContent align="start" className="w-auto p-2">
          <DayPicker
            mode="single"
            weekStartsOn={1}
            selected={date ?? undefined}
            defaultMonth={date ?? today}
            disabled={{ before: today }}
            onSelect={(day) => {
              if (!day) return;
              const next = atDefaultHour(day);
              onChange(time ? withTime(next, time) : next);
              setCalendarOpen(false);
            }}
            className="text-sm [--rdp-accent-background-color:var(--brand-soft)] [--rdp-accent-color:var(--brand)]"
          />
        </PopoverContent>
      </Popover>

      {date ? (
        <div className="flex flex-wrap items-center gap-2 text-cell">
          <span className="font-medium text-ink" aria-live="polite">
            {formatFollowUp(date)}
          </span>
          <label className="sr-only" htmlFor={`${a11y.id}-time`}>
            Follow-up time
          </label>
          <input
            id={`${a11y.id}-time`}
            type="time"
            step={900}
            value={time}
            onChange={(e) => e.target.value && onChange(withTime(value, e.target.value))}
            className={cn(FIELD_CONTROL, "h-8 w-28 px-2 text-cell")}
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded-full px-2 py-1 text-caption text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
}
