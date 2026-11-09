"use client";

import * as React from "react";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { PipelineStagePickers } from "@/components/forms/entity-pickers";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useOwnerOptions } from "@/features/teams/scope-filters";
import type { Pipeline } from "@/lib/api/crm";
import type { CreateLeadInput, CreateLeadValues } from "./create-lead-schema";
import { FollowUpPicker } from "./follow-up-picker";
import { LeadField, TRIGGER_CONTROL } from "./field-ui";

export function useOwnerChoices(enabled: boolean, me: { id: string; fullName: string }): ComboboxOption[] {
  const owners = useOwnerOptions(enabled);
  return React.useMemo(
    () => [
      { value: me.id, label: "Me", description: me.fullName },
      ...(owners.data?.data ?? [])
        .filter((u) => u.id !== me.id)
        .map((u) => ({ value: u.id, label: u.fullName, description: u.email })),
    ],
    [owners.data, me.id, me.fullName],
  );
}

export function SalesSection({
  pipelines,
  canAssignOwner,
  ownerOptions,
  timeZone,
  editing = false,
  ownerLabel = "You",
}: {
  pipelines: Pipeline[];
  canAssignOwner: boolean;
  ownerOptions: ComboboxOption[];
  timeZone?: string;
  /** Existing leads move between stages on the board, where stage requirements are checked. */
  editing?: boolean;
  /** Shown when the owner can't be changed. */
  ownerLabel?: string;
}) {
  const { control } = useFormContext<CreateLeadInput, unknown, CreateLeadValues>();
  const owner = useController({ control, name: "ownerUserId" });
  const pipelineField = useController({ control, name: "pipelineId" });
  const stageField = useController({ control, name: "stageId" });
  const followUp = useController({ control, name: "nextActivityAt" });
  const [pipelineId, stageId] = useWatch({ control, name: ["pipelineId", "stageId"] });
  const [changingStage, setChangingStage] = React.useState(false);

  const pipeline = pipelines.find((p) => p.id === pipelineId);
  const stage = pipeline?.stages.find((s) => s.id === stageId);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <LeadField label="Owner" group>
        {(_a11y, labelId) =>
          canAssignOwner ? (
            <div role="group" aria-labelledby={labelId}>
              <Combobox
                aria-label="Owner"
                options={ownerOptions}
                value={owner.field.value || null}
                onChange={(v) => owner.field.onChange(v ?? ownerOptions[0]?.value ?? "")}
                searchPlaceholder="Search people…"
                emptyText="No one matches"
                triggerClassName={TRIGGER_CONTROL}
              />
            </div>
          ) : (
            <p className="flex h-10 items-center text-body text-ink">{ownerLabel}</p>
          )
        }
      </LeadField>

      <LeadField label="Pipeline and stage" group className={changingStage ? "sm:col-span-2" : undefined}>
        {(_a11y, labelId) =>
          changingStage ? (
            <div role="group" aria-labelledby={labelId}>
              <PipelineStagePickers
                pipelines={pipelines}
                pipelineId={pipelineField.field.value}
                stageId={stageField.field.value}
                onPipelineChange={(pid, sid) => {
                  pipelineField.field.onChange(pid);
                  stageField.field.onChange(sid);
                }}
                onStageChange={stageField.field.onChange}
              />
            </div>
          ) : (
            <div className="flex h-10 items-center justify-between gap-2 rounded-xl border border-line/80 bg-surface px-3 shadow-xs">
              <p className="min-w-0 truncate text-body text-ink">
                {pipeline?.name ?? "Default pipeline"}
                <span className="text-ink-muted"> / </span>
                {stage?.name ?? (editing ? "No stage" : "First stage")}
              </p>
              {editing ? (
                <span className="shrink-0 text-caption text-ink-muted">Board / panel</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setChangingStage(true)}
                  className="shrink-0 rounded-sm text-caption font-medium text-brand-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Change
                </button>
              )}
            </div>
          )
        }
      </LeadField>

      <LeadField label="When to follow up?" group className="sm:col-span-2">
        {(a11y, labelId) => (
          <FollowUpPicker
            value={followUp.field.value}
            onChange={(v) => {
              followUp.field.onChange(v);
              followUp.field.onBlur();
            }}
            timeZone={timeZone}
            a11y={a11y}
            labelId={labelId}
          />
        )}
      </LeadField>
    </div>
  );
}
