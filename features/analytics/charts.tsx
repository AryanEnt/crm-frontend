"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  FunnelChart,
  Funnel,
  LabelList,
  LineChart,
  Line,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { ChartSkeleton } from "@/components/ui/skeleton";

/** Aurora chart palette — teal brand + stage ordinals (design-system §2). */
export const CHART_COLORS = {
  brand: "#0E7490",
  brandDark: "#083344",
  brandSoft: "#ECFEFF",
  /** Ordinal series for multi-bar / funnel (graphite → teal → mid → late) */
  series: ["#0E7490", "#0284C7", "#64748B", "#C2410C", "#047857", "#B45309"],
  /** @deprecated alias — use `series` */
  softIndigo: ["#0E7490", "#0284C7", "#64748B", "#C2410C", "#047857", "#B45309"],
  success: "#047857",
  warning: "#B45309",
  danger: "#B91C1C",
  muted: "#9AA1AD",
  grid: "#E4E7EC",
  tick: "#6B7280",
};

export function ChartCard({
  title,
  question,
  children,
  className,
  loading,
  empty,
  emptyTitle = "No numbers for this range",
  emptyDescription = "Widen the dates or clear filters to see results.",
}: {
  title: string;
  question?: string;
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-surface p-4", className)}>
      <header className="mb-3 space-y-0.5">
        <h3 className="text-section">{title}</h3>
        {question ? <p className="text-meta">{question}</p> : null}
      </header>
      {loading ? (
        <ChartSkeleton />
      ) : empty ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          className="border-0 py-8"
        />
      ) : (
        children
      )}
    </section>
  );
}

function tooltipStyle(): React.CSSProperties {
  return {
    borderRadius: 6,
    border: "1px solid var(--line, #E4E7EC)",
    background: "var(--surface, #fff)",
    fontSize: 12,
    color: "var(--ink, #14171F)",
  };
}

export function SoftIndigoBarChart({
  data,
  xKey = "label",
  yKey = "value",
  valueFormatter,
  height = 260,
}: {
  data: Array<Record<string, string | number>>;
  xKey?: string;
  yKey?: string;
  valueFormatter?: (v: number) => string;
  height?: number;
}) {
  const fmt = valueFormatter ?? ((v: number) => String(v));
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: CHART_COLORS.tick }} />
          <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.tick }} width={48} />
          <Tooltip
            contentStyle={tooltipStyle()}
            formatter={(value: number) => [fmt(value), "Value"]}
          />
          <Bar dataKey={yKey} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS.series[i % CHART_COLORS.series.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SoftIndigoLineChart({
  data,
  xKey = "label",
  yKey = "value",
  valueFormatter,
  height = 240,
}: {
  data: Array<Record<string, string | number>>;
  xKey?: string;
  yKey?: string;
  valueFormatter?: (v: number) => string;
  height?: number;
}) {
  const fmt = valueFormatter ?? ((v: number) => String(v));
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: CHART_COLORS.tick }} />
          <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.tick }} width={48} />
          <Tooltip
            contentStyle={tooltipStyle()}
            formatter={(value: number) => [fmt(value), "Value"]}
          />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={CHART_COLORS.brand}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_COLORS.brandDark }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SoftIndigoFunnelChart({
  data,
  height = 320,
}: {
  data: Array<{ name: string; value: number; fill?: string }>;
  height?: number;
}) {
  const colored = data.map((d, i) => ({
    ...d,
    fill: d.fill ?? CHART_COLORS.series[i % CHART_COLORS.series.length],
  }));
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <FunnelChart>
          <Tooltip
            contentStyle={tooltipStyle()}
            formatter={(value: number) => [value, "Entered"]}
          />
          <Funnel dataKey="value" data={colored} isAnimationActive={false}>
            <LabelList
              position="right"
              fill="#3D4450"
              stroke="none"
              dataKey="name"
              fontSize={12}
            />
            <LabelList
              position="center"
              fill="#fff"
              stroke="none"
              dataKey="value"
              fontSize={12}
            />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  );
}

export function formatMoney(v: number, currency = "AUD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(v);
}

export function formatDuration(secs?: number | null) {
  if (secs == null || Number.isNaN(secs)) return "—";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatPct(v: number) {
  return `${v.toFixed(1)}%`;
}
