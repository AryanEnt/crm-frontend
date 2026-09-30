"use client";

import * as React from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "./button";
import { Portal } from "./overlay";

type ToastTone = "success" | "error" | "info";

export type ToastOptions = {
  description?: string;
  /** e.g. { label: "Undo", onClick } — clicking it also dismisses the toast. */
  action?: { label: string; onClick: () => void };
  duration?: number;
};

type ToastItem = ToastOptions & { id: number; title: string; tone: ToastTone; closing: boolean };

type ToastApi = {
  success: (title: string, options?: ToastOptions) => number;
  error: (title: string, options?: ToastOptions) => number;
  info: (title: string, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
};

const ToastContext = React.createContext<ToastApi | null>(null);

const MAX_VISIBLE = 3;
const EXIT_MS = 150;

let toastSeq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: number) => {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, closing: true } : item)));
    window.setTimeout(() => setItems((list) => list.filter((item) => item.id !== id)), EXIT_MS);
  }, []);

  const api = React.useMemo<ToastApi>(() => {
    const push = (tone: ToastTone) => (title: string, options: ToastOptions = {}) => {
      toastSeq += 1;
      const id = toastSeq;
      setItems((list) => [...list.slice(-(MAX_VISIBLE - 1)), { ...options, id, title, tone, closing: false }]);
      return id;
    };
    return { success: push("success"), error: push("error"), info: push("info"), dismiss };
  }, [dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Portal>
        <section
          aria-label="Notifications"
          className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        >
          {items.map((item) => (
            <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
          ))}
        </section>
      </Portal>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const TONE_ICON = {
  success: { Icon: CircleCheck, className: "text-success" },
  error: { Icon: CircleAlert, className: "text-danger" },
  info: { Icon: Info, className: "text-info" },
} as const;

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const duration = item.duration ?? (item.action ? 8000 : 5000);
  const remaining = React.useRef(duration);
  const [paused, setPaused] = React.useState(false);
  const dismissLater = React.useEffectEvent(onDismiss);

  React.useEffect(() => {
    if (paused || item.closing) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => dismissLater(), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - startedAt;
    };
  }, [paused, item.closing]);

  const { Icon, className: iconClassName } = TONE_ICON[item.tone];
  const action = item.action;

  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      data-state={item.closing ? "closed" : "open"}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex items-start gap-3 rounded-card border border-line bg-surface-raised py-3 pl-3.5 pr-2 shadow-md transition-[opacity,translate] duration-150 ease-standard starting:translate-y-2 starting:opacity-0 data-[state=closed]:translate-x-4 data-[state=closed]:opacity-0"
    >
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", iconClassName)} />
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-cell font-medium text-ink">{item.title}</p>
        {item.description ? <p className="mt-0.5 text-caption text-ink-muted">{item.description}</p> : null}
      </div>
      {action ? (
        <Button
          size="sm"
          variant="ghost"
          className="text-brand hover:text-brand-hover"
          onClick={() => {
            action.onClick();
            onDismiss();
          }}
        >
          {action.label}
        </Button>
      ) : null}
      <IconButton label="Dismiss notification" size="sm" tooltip={false} onClick={onDismiss}>
        <X />
      </IconButton>
    </div>
  );
}
