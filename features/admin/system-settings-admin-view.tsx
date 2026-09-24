"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-provider";
import { adminApi } from "@/lib/api/admin";
import { crmApi } from "@/lib/api/crm";

type SettingDef = {
  key: string;
  label: string;
  type: "text" | "boolean" | "select";
  options?: Array<{ value: string; label: string }>;
};

const SECTIONS: Array<{ title: string; description: string; fields: SettingDef[] }> = [
  {
    title: "Organization",
    description: "Identity and regional defaults for the whole workspace.",
    fields: [
      { key: "organization.name", label: "Organization name", type: "text" },
      { key: "organization.email", label: "Contact email", type: "text" },
      { key: "organization.phone", label: "Phone", type: "text" },
      { key: "organization.address", label: "Address", type: "text" },
      { key: "organization.timezone", label: "Timezone", type: "text" },
      { key: "organization.currency", label: "Currency", type: "text" },
      { key: "organization.date_format", label: "Date format", type: "text" },
      { key: "organization.time_format", label: "Time format", type: "text" },
    ],
  },
  {
    title: "CRM Defaults",
    description: "Defaults applied when creating leads, deals, and activities.",
    fields: [
      { key: "crm.default_pipeline_id", label: "Default pipeline", type: "select", options: [] },
      { key: "crm.default_lead_source", label: "Default lead source", type: "select", options: [] },
      { key: "crm.default_activity_type", label: "Default activity type", type: "select", options: [] },
      { key: "crm.default_lead_priority", label: "Default lead priority", type: "select", options: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "urgent", label: "Urgent" },
      ] },
      { key: "crm.default_deal_currency", label: "Default deal currency", type: "text" },
      { key: "crm.default_followup_hours", label: "Default follow-up (hours)", type: "text" },
      { key: "crm.default_activity_duration_minutes", label: "Default activity duration (min)", type: "text" },
    ],
  },
  {
    title: "Sales",
    description: "Reserved for sales-specific toggles (stored with CRM keys above).",
    fields: [],
  },
  {
    title: "Notifications",
    description: "Email and in-app notification preferences.",
    fields: [
      { key: "notifications.email_enabled", label: "Email notifications", type: "boolean" },
      { key: "notifications.activity_reminders", label: "Activity reminders", type: "boolean" },
      { key: "notifications.overdue_alerts", label: "Overdue alerts", type: "boolean" },
      { key: "notifications.automation", label: "Automation notifications", type: "boolean" },
    ],
  },
  {
    title: "Security",
    description: "Session and access policies.",
    fields: [{ key: "security.session_hours", label: "Session length (hours)", type: "text" }],
  },
];

function settingsToMap(items: Array<{ key: string; value: string }>) {
  const m: Record<string, string> = {};
  for (const it of items) m[it.key] = it.value;
  return m;
}

export function SystemSettingsAdminView() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const canManage = can("settings:manage");
  const canView = can("settings:view") || canManage;

  const settingsQuery = useQuery({
    queryKey: ["org-settings"],
    queryFn: () => adminApi.listSettings(),
    enabled: canView,
  });

  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "settings"],
    queryFn: () => crmApi.listPipelines(undefined, true),
    enabled: canView,
  });

  const sourcesQuery = useQuery({
    queryKey: ["lead-sources", "settings"],
    queryFn: () => adminApi.listLeadSources({ activeOnly: true }),
    enabled: canView,
  });

  const typesQuery = useQuery({
    queryKey: ["activity-types", "settings"],
    queryFn: () => crmApi.listActivityTypes(),
    enabled: canView,
  });

  const [draft, setDraft] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (settingsQuery.data) {
      setDraft(settingsToMap(settingsQuery.data));
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => adminApi.updateSettings(draft),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["org-settings"] });
      toast.success("Settings saved");
    },
    onError: (err: Error) => toast.error(err.message || "Save failed"),
  });

  const dynamicOptions = React.useMemo(() => {
    const pipelines = (pipelinesQuery.data ?? []).map((p) => ({ value: p.id, label: p.name }));
    const sources = (sourcesQuery.data ?? []).map((s) => ({ value: s.name, label: s.name }));
    const types = (typesQuery.data ?? []).map((t) => ({ value: t.code, label: t.name }));
    return { pipelines, sources, types };
  }, [pipelinesQuery.data, sourcesQuery.data, typesQuery.data]);

  if (!canView) {
    return (
      <ErrorState title="Access denied" description="Settings require settings:view." />
    );
  }

  if (settingsQuery.isLoading) return <LoadingState />;
  if (settingsQuery.isError) {
    return <ErrorState onRetry={() => void settingsQuery.refetch()} />;
  }

  const setValue = (key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumbs={[
          { label: "Control Center", href: "/" },
          { label: "System Settings" },
        ]}
        title="System Settings"
        description="Organization-wide configuration stored in the CRM database."
        actions={
          canManage ? (
            <Button size="sm" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              Save changes
            </Button>
          ) : null
        }
      />

      <div className="space-y-4">
        {SECTIONS.map((section) =>
          section.fields.length ? (
            <section
              key={section.title}
              className="rounded-lg border border-border bg-surface p-4 space-y-3"
            >
              <div>
                <h2 className="text-sm font-semibold">{section.title}</h2>
                <p className="text-xs text-foreground-muted">{section.description}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {section.fields.map((field) => {
                  let options = field.options ?? [];
                  if (field.key === "crm.default_pipeline_id") options = dynamicOptions.pipelines;
                  if (field.key === "crm.default_lead_source") options = dynamicOptions.sources;
                  if (field.key === "crm.default_activity_type") options = dynamicOptions.types;

                  const value = draft[field.key] ?? "";

                  if (field.type === "boolean") {
                    return (
                      <label key={field.key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          disabled={!canManage}
                          checked={value === "true" || value === "1"}
                          onCheckedChange={(v) => setValue(field.key, v === true ? "true" : "false")}
                        />
                        {field.label}
                      </label>
                    );
                  }

                  if (field.type === "select" && options.length) {
                    return (
                      <div key={field.key} className="space-y-1.5">
                        <Label>{field.label}</Label>
                        <Select
                          disabled={!canManage}
                          value={value || "none"}
                          onValueChange={(v) => setValue(field.key, v === "none" ? "" : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Not set" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Not set</SelectItem>
                            {options.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  }

                  return (
                    <div key={field.key} className="space-y-1.5">
                      <Label>{field.label}</Label>
                      <Input
                        disabled={!canManage}
                        value={value}
                        onChange={(e) => setValue(field.key, e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            <section
              key={section.title}
              className="rounded-lg border border-dashed border-border bg-surface-muted/30 p-4"
            >
              <h2 className="text-sm font-semibold">{section.title}</h2>
              <p className="text-xs text-foreground-muted">{section.description}</p>
            </section>
          ),
        )}
      </div>
    </div>
  );
}
