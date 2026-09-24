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
import { LoadingState } from "@/components/ui/loading-state";

export const CHART_COLORS = {
  brand: "#6c63d9",
  brandDark: "#403a8f",
  brandSoft: "#eeecff",
  softIndigo: ["#6c63d9", "#7f78df", "#9590e6", "#aaa6ec", "#c0bdf2", "#d5d3f7"],
  success: "#1f9d63",
  warning: "#d97706",
  danger: "#dc2626",
  muted: "#94a3b8",
};

export function ChartCard({
  title,
  question,
  children,
  className,
  loading,
  empty,
  emptyTitle = "No data for this range",
  emptyDescription = "Adjust filters or expand the date range.",
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
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {question ? (
          <p className="text-xs text-foreground-muted">{question}</p>
        ) : null}
      </header>
      {loading ? (
        <LoadingState />
      ) : empty ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        children
      )}
    </section>
  );
}

function tooltipStyle(): React.CSSProperties {
  return {
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#fff",
    fontSize: 12,
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
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e6f5" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} width={48} />
          <Tooltip
            contentStyle={tooltipStyle()}
            formatter={(value: number) => [fmt(value), "Value"]}
          />
          <Bar dataKey={yKey} radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={CHART_COLORS.softIndigo[i % CHART_COLORS.softIndigo.length]}
              />
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
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e6f5" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} width={48} />
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
    fill: d.fill ?? CHART_COLORS.softIndigo[i % CHART_COLORS.softIndigo.length],
  }));
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <FunnelChart>
          <Tooltip
            contentStyle={tooltipStyle()}
            formatter={(value: number) => [value, "Entered"]}
          />
          <Funnel dataKey="value" data={colored} isAnimationActive>
            <LabelList position="right" fill="#334155" stroke="none" dataKey="name" fontSize={12} />
            <LabelList position="center" fill="#fff" stroke="none" dataKey="value" fontSize={12} />
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
