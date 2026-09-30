"use client";

import * as React from "react";
import { Search, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasOpenLayer } from "./overlay";

/** Shared control surface for text-like inputs; height is applied separately. */
export const CONTROL =
  "w-full min-w-0 rounded-control border border-line bg-surface px-2.5 text-body text-ink shadow-xs transition-[border-color,background-color,box-shadow] duration-150 ease-standard placeholder:text-ink-muted hover:border-line-strong focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/25";

/** md = toolbars and filter bars (32px); lg = form fields (36px). */
export type ControlSize = "md" | "lg";
export const CONTROL_HEIGHT: Record<ControlSize, string> = { md: "h-8", lg: "h-9" };

export type InputProps = React.ComponentProps<"input"> & {
  invalid?: boolean;
  uiSize?: ControlSize;
  leadingIcon?: LucideIcon;
  trailing?: React.ReactNode;
  wrapperClassName?: string;
};

export function Input({
  invalid,
  uiSize = "md",
  leadingIcon: Icon,
  trailing,
  wrapperClassName,
  className,
  type = "text",
  ...props
}: InputProps) {
  const field = (
    <input
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, CONTROL_HEIGHT[uiSize], Icon && "pl-8", trailing != null && "pr-9", className)}
      {...props}
    />
  );
  if (!Icon && trailing == null) return field;
  return (
    <div className={cn("relative w-full min-w-0", wrapperClassName)}>
      {Icon ? (
        <Icon
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
        />
      ) : null}
      {field}
      {trailing != null ? (
        <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>
      ) : null}
    </div>
  );
}

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

export type SearchInputProps = {
  /** Committed (debounced) value; external changes (e.g. "Clear filters") reset the text. */
  value: string;
  onValueChange: (value: string) => void;
  delay?: number;
  placeholder?: string;
  /** Focus with "/" when nothing else is being typed into and no overlay is open. */
  hotkey?: boolean;
  "aria-label"?: string;
  className?: string;
};

export function SearchInput({
  value,
  onValueChange,
  delay = 250,
  placeholder = "Search…",
  hotkey = true,
  "aria-label": ariaLabel = "Search",
  className,
}: SearchInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [text, setText] = React.useState(value);
  const [committed, setCommitted] = React.useState(value);
  const [lastEmitted, setLastEmitted] = React.useState(value);
  if (value !== committed) {
    setCommitted(value);
    if (value !== lastEmitted) setText(value);
  }

  const emit = React.useEffectEvent((next: string) => {
    setLastEmitted(next);
    onValueChange(next);
  });

  React.useEffect(() => {
    if (text === value) return;
    const timer = window.setTimeout(() => emit(text), delay);
    return () => window.clearTimeout(timer);
  }, [text, value, delay]);

  React.useEffect(() => {
    if (!hotkey) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target) || hasOpenLayer()) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hotkey]);

  const clear = () => {
    setText("");
    setLastEmitted("");
    onValueChange("");
    inputRef.current?.focus();
  };

  return (
    <Input
      ref={inputRef}
      type="search"
      role="searchbox"
      aria-label={ariaLabel}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        if (text) {
          event.preventDefault();
          clear();
        } else {
          event.currentTarget.blur();
        }
      }}
      leadingIcon={Search}
      wrapperClassName={className}
      className="[&::-webkit-search-cancel-button]:appearance-none"
      trailing={
        text ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="inline-flex size-6 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-surface-muted hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : hotkey ? (
          <kbd
            aria-hidden
            className="pointer-events-none mr-1 hidden h-5 min-w-5 items-center justify-center rounded border border-line bg-surface-sunken px-1 font-sans text-caption text-ink-muted sm:inline-flex"
          >
            /
          </kbd>
        ) : null
      }
    />
  );
}
