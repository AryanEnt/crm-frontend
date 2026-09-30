import type { CSSProperties } from "react";
import { CalendarCheck, Handshake, LayoutGrid, UserPlus, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* Illustrative figures only: this preview must never read workspace data. */

type Metric = { label: string; value: number; icon: LucideIcon; tone: string };

const METRICS: Metric[] = [
  { label: "Leads", value: 128, icon: UserPlus, tone: "bg-(--aurora-lavender) text-(--aurora-lavender-ink)" },
  { label: "Customers", value: 84, icon: Users, tone: "bg-(--aurora-blue-soft) text-(--aurora-blue-ink)" },
  { label: "Deals", value: 36, icon: Handshake, tone: "bg-(--aurora-cyan-soft) text-(--aurora-cyan-ink)" },
];

const STAGES = [
  { label: "Cold Lead", count: 42, width: 92, fill: "bg-(--aurora-stage-1)" },
  { label: "New Potential", count: 31, width: 72, fill: "bg-(--aurora-stage-2)" },
  { label: "Contact Made", count: 24, width: 56, fill: "bg-(--aurora-stage-3)" },
  { label: "Submitted", count: 15, width: 38, fill: "bg-(--aurora-stage-4)" },
  { label: "Waiting Outcome", count: 9, width: 24, fill: "bg-(--aurora-stage-5)" },
] as const;

const TREND_LINE = "M4 50 C 34 49, 52 44, 80 43 S 126 38, 152 33 S 204 30, 228 22 S 276 10, 316 7";

/** Decorative rising curve. `gradientId` must be unique per instance on the page. */
function TrendLine({ gradientId, className }: { gradientId: string; className?: string }) {
  return (
    <svg viewBox="0 0 320 56" fill="none" focusable="false" className={cn("h-auto w-full overflow-visible", className)}>
      <defs>
        <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--aurora-primary)" stopOpacity="0.42" />
          <stop offset="100%" stopColor="var(--aurora-blue)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${gradientId}-stroke`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--aurora-primary)" />
          <stop offset="100%" stopColor="var(--aurora-indigo)" />
        </linearGradient>
      </defs>
      <line x1="4" x2="316" y1="18" y2="18" strokeDasharray="2 5" className="stroke-(--aurora-line)" />
      <line x1="4" x2="316" y1="38" y2="38" strokeDasharray="2 5" className="stroke-(--aurora-line)" />
      <path d={`${TREND_LINE} L316 56 L4 56 Z`} fill={`url(#${gradientId}-fill)`} />
      <path
        d={TREND_LINE}
        stroke={`url(#${gradientId}-stroke)`}
        strokeWidth={2.25}
        strokeLinecap="round"
      />
      <circle cx="316" cy="7" r="7" className="fill-(--aurora-primary)" fillOpacity={0.3} />
      <circle cx="316" cy="7" r="3.5" className="fill-(--aurora-indigo)" />
    </svg>
  );
}

function IconChip({ icon: Icon, tone, className }: { icon: LucideIcon; tone: string; className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-lg", tone, className)}>
      <Icon className="size-3.5" strokeWidth={2} aria-hidden />
    </span>
  );
}

/** Slow-drifting lavender, indigo and pale blue glows behind the preview. */
export function AuroraGlow({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="aurora-glow aurora-drift-a -left-40 -top-32 size-[36rem] bg-(--aurora-primary) opacity-35 blur-[120px]" />
      <div className="aurora-glow aurora-drift-b -right-40 top-1/3 size-[30rem] bg-(--aurora-indigo) opacity-20 blur-[120px]" />
      <div className="aurora-glow aurora-drift-c -bottom-24 left-1/4 size-[20rem] bg-(--aurora-blue) opacity-45 blur-[100px]" />
    </div>
  );
}

/** Large product preview for the sign-in screen (tablet and desktop). */
export function AuroraPreviewCard({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative select-none", className)}>
      <div className="aurora-card aurora-card-in rounded-[26px] p-4 lg:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="aurora-mark flex size-8 items-center justify-center rounded-[10px] text-caption font-bold text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2)]">
              A
            </span>
            <div>
              <p className="text-heading text-ink">CRMAurora</p>
              <p className="text-meta">Sales overview</p>
            </div>
          </div>
          <span className="aurora-tile flex size-8 items-center justify-center rounded-full text-(--aurora-lavender-ink)">
            <LayoutGrid className="size-3.5" strokeWidth={2} />
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 lg:mt-5 lg:gap-3">
          {METRICS.map((metric) => (
            <div key={metric.label} className="aurora-tile rounded-2xl p-2.5 lg:p-3.5">
              <IconChip icon={metric.icon} tone={metric.tone} className="size-7" />
              <p className="mt-2.5 text-meta lg:mt-3">{metric.label}</p>
              <p className="text-numeral-sm lg:text-numeral">{metric.value}</p>
            </div>
          ))}
        </div>

        <div className="aurora-tile mt-2 rounded-2xl p-3 lg:mt-3 lg:p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-label">Pipeline</p>
            <p className="text-meta">5 stages</p>
          </div>
          <ul className="mt-3 flex flex-col gap-2 lg:gap-2.5">
            {STAGES.map((stage, index) => (
              <li
                key={stage.label}
                className="grid grid-cols-[6.5rem_1fr_1.25rem] items-center gap-2.5 lg:grid-cols-[6.75rem_1fr_1.5rem] lg:gap-3"
              >
                <span className="truncate text-caption text-ink-secondary">{stage.label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-(--aurora-track)">
                  <span
                    className={cn("aurora-bar block h-full rounded-full", stage.fill)}
                    style={{ width: `${stage.width}%`, "--bar-index": index } as CSSProperties}
                  />
                </span>
                <span className="text-right text-caption tabular-nums text-ink-muted">{stage.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="aurora-tile mt-2 rounded-2xl px-3 pb-2.5 pt-3 lg:mt-3 lg:px-4">
          <div className="flex items-center justify-between">
            <p className="text-label">Pipeline momentum</p>
            <span className="rounded-full bg-(--aurora-lavender) px-2 py-0.5 text-caption font-medium tabular-nums text-(--aurora-lavender-ink)">
              +18.4%
            </span>
          </div>
          <TrendLine gradientId="aurora-trend-lg" className="mt-2" />
        </div>
      </div>

      <div className="aurora-float-in absolute -bottom-6 -right-3 lg:-right-10">
        <div className="aurora-float aurora-float-card flex items-center gap-3 rounded-2xl py-2.5 pl-2.5 pr-4 lg:py-3 lg:pl-3 lg:pr-5">
          <IconChip
            icon={CalendarCheck}
            tone="bg-(--aurora-indigo-soft) text-(--aurora-indigo-ink)"
            className="size-8 rounded-xl"
          />
          <div>
            <p className="text-caption font-medium text-ink">Today&apos;s activity</p>
            <p className="text-meta">12 follow-ups scheduled</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact preview shown above the form on small screens. */
export function AuroraPreviewCompact({ className }: { className?: string }) {
  const [leads, , deals] = METRICS;
  return (
    <div aria-hidden className={cn("relative select-none", className)}>
      <div className="pointer-events-none absolute -inset-x-10 -inset-y-8">
        <div className="aurora-glow aurora-drift-a -left-6 top-0 size-40 bg-(--aurora-primary) opacity-40 blur-[56px]" />
        <div className="aurora-glow aurora-drift-c right-0 bottom-0 size-32 bg-(--aurora-blue) opacity-50 blur-[48px]" />
      </div>
      <div className="aurora-card aurora-card-in relative flex items-center gap-2 rounded-[22px] p-2.5">
        {[leads, deals].map((metric) => (
          <div key={metric.label} className="aurora-tile flex items-center gap-2 rounded-2xl py-2 pl-2 pr-3">
            <IconChip icon={metric.icon} tone={metric.tone} className="size-7" />
            <div>
              <p className="text-meta leading-none">{metric.label}</p>
              <p className="mt-1 text-numeral-sm leading-none">{metric.value}</p>
            </div>
          </div>
        ))}
        <TrendLine gradientId="aurora-trend-sm" className="ml-auto w-20 shrink-0 pr-1" />
      </div>
    </div>
  );
}
