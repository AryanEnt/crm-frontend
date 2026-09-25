"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AtSign,
  Building2,
  CalendarDays,
  CircleDot,
  Globe2,
  Handshake,
  MessageCircle,
  Phone,
  Share2,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { FormFieldSlot } from "@/components/forms/form-field";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { adminApi } from "@/lib/api/admin";
import { crmApi, type Pipeline } from "@/lib/api/crm";
import type { EntityPickerOption } from "@/components/forms/types";
import { cn } from "@/lib/utils";

const COUNTRIES: EntityPickerOption[] = [
  { value: "Australia", label: "Australia" },
  { value: "Nepal", label: "Nepal" },
  { value: "India", label: "India" },
  { value: "New Zealand", label: "New Zealand" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "United States", label: "United States" },
  { value: "Canada", label: "Canada" },
  { value: "Philippines", label: "Philippines" },
  { value: "China", label: "China" },
  { value: "Sri Lanka", label: "Sri Lanka" },
  { value: "Bangladesh", label: "Bangladesh" },
  { value: "Pakistan", label: "Pakistan" },
  { value: "Indonesia", label: "Indonesia" },
  { value: "Vietnam", label: "Vietnam" },
  { value: "South Africa", label: "South Africa" },
];

export function CountryPicker({
  value,
  onChange,
  error,
}: {
  value?: string;
  onChange: (v: string) => void;
  error?: boolean;
}) {
  const options = React.useMemo(() => {
    if (value && !COUNTRIES.some((c) => c.value === value)) {
      return [{ value, label: value }, ...COUNTRIES];
    }
    return COUNTRIES;
  }, [value]);

  return (
    <SearchableSelect
      value={value || null}
      onChange={(v) => onChange(v ?? "")}
      options={options}
      placeholder="Search country…"
      searchPlaceholder="Search country…"
      emptyText="No countries found"
      error={error}
    />
  );
}

export function UserPicker({
  value,
  onChange,
  label = "Owner",
  required,
  error,
  placeholder = "Select owner…",
  triggerClassName,
}: {
  value?: string;
  onChange: (v: string) => void;
  label?: string;
  required?: boolean;
  error?: boolean;
  placeholder?: string;
  triggerClassName?: string;
}) {
  const usersQuery = useQuery({
    queryKey: ["users", "entity-picker"],
    queryFn: () => adminApi.listUsers(new URLSearchParams({ limit: "100", isActive: "true" })),
  });

  const options: ComboboxOption[] = (usersQuery.data?.data ?? []).map((u) => ({
    value: u.id,
    label: u.fullName,
    description: u.email,
    visual: <UserAvatar name={u.fullName} />,
  }));

  return (
    <FormFieldSlot label={label} required={required} error={error ? "Required" : undefined}>
      <Combobox
        aria-label={label}
        options={options}
        value={value && value !== "none" ? value : null}
        onChange={(v) => onChange(v ?? "")}
        loading={usersQuery.isLoading}
        placeholder={usersQuery.isError ? "Couldn't load owners" : placeholder}
        searchPlaceholder="Search owners…"
        emptyText={usersQuery.isError ? "Couldn't load owners. Try again." : "No users found"}
        clearable={!required}
        triggerClassName={cn(triggerClassName, error && "border-destructive")}
      />
    </FormFieldSlot>
  );
}

function UserAvatar({ name }: { name: string }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  return (
    <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-muted text-[10px] font-medium text-ink-secondary">
      {initial}
    </span>
  );
}

export function TeamPicker({
  value,
  onChange,
  label = "Team",
  required,
  error,
}: {
  value?: string;
  onChange: (v: string) => void;
  label?: string;
  required?: boolean;
  error?: boolean;
}) {
  const teamsQuery = useQuery({
    queryKey: ["teams", "entity-picker"],
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "100", isActive: "true" })),
  });

  const options: EntityPickerOption[] = (teamsQuery.data?.data ?? []).map((t) => ({
    value: t.id,
    label: t.name,
    description: t.teamLeadName ? `Team Lead: ${t.teamLeadName}` : "No Team Lead",
  }));

  return (
    <FormFieldSlot label={label} required={required} error={error ? "Required" : undefined}>
      <SearchableSelect
        value={value && value !== "none" ? value : null}
        onChange={(v) => onChange(v ?? "")}
        options={options}
        loading={teamsQuery.isLoading}
        placeholder="Select team…"
        emptyText="No teams found"
        error={error}
      />
    </FormFieldSlot>
  );
}

export function PipelineStagePickers({
  pipelines,
  pipelineId,
  stageId,
  onPipelineChange,
  onStageChange,
  pipelineLabel = "Pipeline",
  stageLabel = "Stage",
}: {
  pipelines: Pipeline[];
  pipelineId: string;
  stageId: string;
  onPipelineChange: (pipelineId: string, firstStageId: string) => void;
  onStageChange: (stageId: string) => void;
  pipelineLabel?: string;
  stageLabel?: string;
}) {
  const pipeline = pipelines.find((p) => p.id === pipelineId);
  const pipelineOpts = pipelines.map((p) => ({ value: p.id, label: p.name }));
  const stageOpts = (pipeline?.stages ?? []).map((s) => ({ value: s.id, label: s.name }));

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormFieldSlot label={pipelineLabel}>
        <SearchableSelect
          value={pipelineId && pipelineId !== "none" ? pipelineId : null}
          onChange={(v) => {
            const p = pipelines.find((x) => x.id === v);
            onPipelineChange(v ?? "none", p?.stages[0]?.id ?? "none");
          }}
          options={pipelineOpts}
          placeholder="Select pipeline…"
          emptyText="No pipelines"
        />
      </FormFieldSlot>
      <FormFieldSlot label={stageLabel}>
        <SearchableSelect
          value={stageId && stageId !== "none" ? stageId : null}
          onChange={(v) => onStageChange(v ?? "none")}
          options={stageOpts}
          placeholder="Select stage…"
          emptyText="No stages"
        />
      </FormFieldSlot>
    </div>
  );
}

const SOURCE_META: Record<
  string,
  { icon: LucideIcon; tint: string; active: string }
> = {
  website: {
    icon: Globe2,
    tint: "text-info",
    active: "bg-info-soft text-info ring-1 ring-info/25",
  },
  facebook: {
    icon: Share2,
    tint: "text-[#1877F2]",
    active: "bg-[#E8F1FF] text-[#1877F2] ring-1 ring-[#1877F2]/25",
  },
  instagram: {
    icon: AtSign,
    tint: "text-[#E1306C]",
    active: "bg-[#FCE8F0] text-[#E1306C] ring-1 ring-[#E1306C]/25",
  },
  google: {
    icon: Globe2,
    tint: "text-[#4285F4]",
    active: "bg-[#E8F0FE] text-[#1967D2] ring-1 ring-[#4285F4]/25",
  },
  whatsapp: {
    icon: MessageCircle,
    tint: "text-[#25D366]",
    active: "bg-[#E9F9EF] text-[#128C7E] ring-1 ring-[#25D366]/30",
  },
  "walk-in": {
    icon: Building2,
    tint: "text-brand",
    active: "bg-brand-soft text-brand-dark ring-1 ring-brand/25",
  },
  walk_in: {
    icon: Building2,
    tint: "text-brand",
    active: "bg-brand-soft text-brand-dark ring-1 ring-brand/25",
  },
  partner: {
    icon: Handshake,
    tint: "text-brand",
    active: "bg-brand-soft text-brand-dark ring-1 ring-brand/25",
  },
  agent: {
    icon: UserRound,
    tint: "text-foreground-muted",
    active: "bg-surface-muted text-foreground ring-1 ring-border-strong",
  },
  referral: {
    icon: Users,
    tint: "text-success",
    active: "bg-success-soft text-success ring-1 ring-success/25",
  },
  "cold call": {
    icon: Phone,
    tint: "text-warning",
    active: "bg-warning-soft text-warning ring-1 ring-warning/25",
  },
  cold_call: {
    icon: Phone,
    tint: "text-warning",
    active: "bg-warning-soft text-warning ring-1 ring-warning/25",
  },
  event: {
    icon: CalendarDays,
    tint: "text-brand",
    active: "bg-brand-soft text-brand-dark ring-1 ring-brand/25",
  },
  social: {
    icon: Share2,
    tint: "text-info",
    active: "bg-info-soft text-info ring-1 ring-info/25",
  },
  other: {
    icon: CircleDot,
    tint: "text-foreground-muted",
    active: "bg-surface-muted text-foreground ring-1 ring-border-strong",
  },
};

function sourceMeta(name: string) {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  return (
    SOURCE_META[key] ??
    SOURCE_META[key.replace(/ /g, "_")] ?? {
      icon: CircleDot,
      tint: "text-foreground-muted",
      active: "bg-brand-soft text-brand-dark ring-1 ring-brand/25",
    }
  );
}

export function LeadSourceSelect({
  value,
  onChange,
  sources,
  error,
  required,
  triggerClassName: _triggerClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  sources: readonly string[];
  error?: boolean;
  required?: boolean;
  /** Kept for call-site compatibility; chip grid does not use a trigger. */
  triggerClassName?: string;
}) {
  void _triggerClassName;
  const list = sources;

  return (
    <FormFieldSlot
      label="Lead Source"
      required={required}
      error={error ? "Lead source is required" : undefined}
    >
      <div
        role="radiogroup"
        aria-label="Lead source"
        aria-required={required || undefined}
        aria-invalid={error || undefined}
        className={cn(
          "grid grid-cols-2 gap-1.5 sm:grid-cols-3",
          error && "rounded-md ring-2 ring-destructive/30 ring-offset-1",
        )}
      >
        {list.map((source) => {
          const active = value === source;
          const meta = sourceMeta(source);
          const Icon = meta.icon;
          return (
            <button
              key={source}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(source)}
              className={cn(
                "group flex h-10 items-center gap-2 rounded-md px-2.5 text-left text-[12px] font-medium transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                active
                  ? meta.active
                  : "border border-border bg-surface text-foreground-muted hover:border-border-strong hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md transition-colors",
                  active ? "bg-white/70" : "bg-surface-muted group-hover:bg-surface",
                )}
              >
                <Icon className={cn("size-3.5", active ? meta.tint : "text-foreground-subtle")} />
              </span>
              <span className="min-w-0 truncate">{source}</span>
            </button>
          );
        })}
      </div>
    </FormFieldSlot>
  );
}

export function PriorityToggle({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: "low" | "medium" | "high" | "urgent") => void;
}) {
  const opts = [
    {
      id: "low" as const,
      label: "Low",
      idle: "text-success hover:bg-success-soft/60",
      active: "bg-success-soft text-success ring-1 ring-success/25",
      dot: "bg-success",
    },
    {
      id: "medium" as const,
      label: "Medium",
      idle: "text-warning hover:bg-warning-soft/60",
      active: "bg-warning-soft text-warning ring-1 ring-warning/25",
      dot: "bg-warning",
    },
    {
      id: "high" as const,
      label: "High",
      idle: "text-destructive hover:bg-destructive-soft/60",
      active: "bg-destructive-soft text-destructive ring-1 ring-destructive/25",
      dot: "bg-destructive",
    },
  ];

  return (
    <FormFieldSlot label="Priority">
      <div
        className="grid grid-cols-3 gap-1.5"
        role="group"
        aria-label="Priority"
      >
        {opts.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={
                active
                  ? `flex h-9 items-center justify-center gap-1.5 rounded-md text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${o.active}`
                  : `flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-surface text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${o.idle}`
              }
              aria-pressed={active}
            >
              <span className={`size-1.5 shrink-0 rounded-full ${o.dot}`} aria-hidden />
              {o.label}
            </button>
          );
        })}
      </div>
    </FormFieldSlot>
  );
}
