"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useController, useWatch, type Control, type SubmitErrorHandler } from "react-hook-form";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import {
  CrmFormSection,
  focusFirstInvalid,
  Form,
  FormFieldSlot,
  FormScope,
  QuickCreateDrawer,
  SearchableSelect,
  SubmitButton,
  TextareaField,
  TextField,
  useZodForm,
} from "@/components/forms";
import { PipelineStagePickers, PriorityToggle, UserPicker } from "@/components/forms/entity-pickers";
import { CustomFieldsSection } from "@/components/forms/custom-fields-section";
import { Button } from "@/components/ui/console/button";
import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi, type Customer, type Deal, type Pipeline } from "@/lib/api/crm";
import { copy } from "@/lib/copy";
import { applyServerError, type ServerErrorRule } from "@/lib/forms/server-errors";
import { cn } from "@/lib/utils";
import {
  dealCreateSchema,
  type DealCreateInput,
  type DealCreateValues,
} from "@/validations/deal";

const FORM_ID = "deal-create-form";
const MORE_DETAIL_FIELDS = new Set<string>(["priority", "source", "notes"]);

const SERVER_ERRORS: ServerErrorRule<DealCreateInput>[] = [
  { match: /invalid expectedCloseAt/i, field: "expectedCloseAt", message: "Enter a valid date" },
];

type Settings = Record<string, string>;

/** Context pipeline, then the org default (when it's a sales pipeline), then the flagged default, then the first. */
function pickPipeline(pipelines: Pipeline[], preferredId?: string | null, settings?: Settings) {
  const byId = (id?: string | null) => (id ? pipelines.find((p) => p.id === id) : undefined);
  return (
    byId(preferredId) ??
    byId(settings?.["crm.default_pipeline_id"]?.trim()) ??
    pipelines.find((p) => p.isDefault) ??
    pipelines[0]
  );
}

function defaultValues({
  pipelines,
  settings,
  customer,
  defaultPipelineId,
  userId,
}: {
  pipelines: Pipeline[];
  settings?: Settings;
  customer?: Customer;
  defaultPipelineId?: string;
  userId?: string;
}): DealCreateInput {
  const pipeline = pickPipeline(pipelines, defaultPipelineId || customer?.pipelineId, settings);
  const contextStage = pipeline?.stages.find((s) => s.id === customer?.stageId);
  return {
    title: customer ? `Deal for ${customer.fullName}` : "",
    customerId: customer?.id ?? "",
    value: "",
    expectedCloseAt: "",
    ownerUserId: customer?.ownerUserId ?? userId ?? "",
    pipelineId: pipeline?.id ?? "",
    stageId: contextStage?.id ?? pipeline?.stages[0]?.id ?? "",
    priority: "medium",
    source: "",
    notes: "",
  };
}

/**
 * The one deal-create form. Callers pass context and the defaults follow it:
 * the board and deals table pass their pipeline, Customer 360 passes the customer
 * (which fixes the customer and seeds owner, team, pipeline and stage).
 */
export function DealQuickCreateDrawer({
  open,
  onOpenChange,
  defaultPipelineId,
  customer,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPipelineId?: string;
  customer?: Customer;
  onCreated?: (deal: Deal) => void;
}) {
  const { can } = useAuth();
  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "sales"],
    queryFn: () => crmApi.listPipelines("sales"),
    enabled: open,
  });
  const settingsQuery = useQuery({
    queryKey: ["org-settings", "map"],
    queryFn: () => crmApi.getSettingsMap(),
    enabled: open,
    staleTime: 60_000,
  });

  if (!open || !can("deals:create")) return null;
  if (!pipelinesQuery.isFetched || !settingsQuery.isFetched) {
    return (
      <QuickCreateDrawer open onOpenChange={onOpenChange} title="Create deal">
        <LoadingState compact label="Loading form…" />
      </QuickCreateDrawer>
    );
  }
  return (
    <DealCreateBody
      onOpenChange={onOpenChange}
      pipelines={pipelinesQuery.data ?? []}
      settings={settingsQuery.data}
      defaultPipelineId={defaultPipelineId}
      customer={customer}
      onCreated={onCreated}
    />
  );
}

function DealCreateBody({
  onOpenChange,
  pipelines,
  settings,
  defaultPipelineId,
  customer,
  onCreated,
}: {
  onOpenChange: (open: boolean) => void;
  pipelines: Pipeline[];
  settings?: Settings;
  defaultPipelineId?: string;
  customer?: Customer;
  onCreated?: (deal: Deal) => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const canAssignOwner = user?.roleCode === "sales_manager";
  const currency = settings?.["crm.default_deal_currency"]?.trim().toUpperCase() || "";

  const bodyRef = React.useRef<HTMLDivElement>(null);
  const [moreDetails, setMoreDetails] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [customFields, setCustomFields] = React.useState<Record<string, unknown>>({});

  const form = useZodForm(dealCreateSchema, {
    defaultValues: defaultValues({ pipelines, settings, customer, defaultPipelineId, userId: user?.id }),
  });
  const [pipelineId, stageId] = useWatch({ control: form.control, name: ["pipelineId", "stageId"] });

  const onInvalid: SubmitErrorHandler<DealCreateInput> = (errors) => {
    if (Object.keys(errors).some((name) => MORE_DETAIL_FIELDS.has(name))) setMoreDetails(true);
    focusFirstInvalid(bodyRef.current);
  };

  const save = async (values: DealCreateValues) => {
    setFormError(null);
    let deal: Deal;
    try {
      deal = await crmApi.createDeal({
        title: values.title,
        customerId: values.customerId,
        value: values.value ? Number(values.value) : null,
        ...(currency ? { currency } : {}),
        expectedCloseAt: values.expectedCloseAt || null,
        ownerUserId: canAssignOwner ? values.ownerUserId || null : (user?.id ?? null),
        ...(customer?.teamId ? { teamId: customer.teamId } : {}),
        pipelineId: values.pipelineId || null,
        stageId: values.stageId || null,
        priority: values.priority,
        source: values.source,
        notes: values.notes,
      });
    } catch (err) {
      if (applyServerError(form, err, SERVER_ERRORS)) return;
      const message = err instanceof Error ? err.message : "";
      setFormError(
        /stage does not belong/i.test(message)
          ? "That stage isn't in the selected pipeline. Choose another stage."
          : message || copy.error.generic,
      );
      return;
    }
    if (Object.keys(customFields).length > 0) {
      try {
        await crmApi.setCustomFieldValues("deal", deal.id, customFields);
      } catch {
        toast.warning("Deal created, but its custom fields didn't save. Add them from the deal page.");
      }
    }
    toast.success("Deal created", {
      action: { label: "Open", onClick: () => router.push(`/deals/${deal.id}`) },
    });
    onOpenChange(false);
    onCreated?.(deal);
  };

  const footer = (
    <div className="flex w-full flex-col gap-2">
      {formError ? (
        <p role="alert" className="text-caption text-danger">
          {formError}
        </p>
      ) : null}
      <div className="flex w-full justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <SubmitButton form={FORM_ID}>Create deal</SubmitButton>
      </div>
    </div>
  );

  return (
    <FormScope form={form} schema={dealCreateSchema}>
      <QuickCreateDrawer
        open
        onOpenChange={onOpenChange}
        title="Create deal"
        description={customer ? `For ${customer.fullName}` : "Title and customer are enough to start."}
        className={cn("shadow-[-6px_0_24px_rgba(42,40,56,0.06)]", "sm:max-w-[460px]")}
        footer={footer}
      >
        <div ref={bodyRef}>
          <Form
            id={FORM_ID}
            form={form}
            schema={dealCreateSchema}
            onSubmit={save}
            onInvalid={onInvalid}
            className="space-y-5"
          >
            <CrmFormSection title="Deal">
              <TextField name="title" label="Title" autoFocus autoComplete="off" />
              {customer ? null : <CustomerField control={form.control} />}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <TextField
                  name="value"
                  label="Value"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  trailing={
                    <span className="pr-1.5 text-caption text-ink-muted">{currency || "AUD"}</span>
                  }
                />
                <TextField name="expectedCloseAt" label="Expected close" type="date" />
              </div>
            </CrmFormSection>

            <CrmFormSection title="Pipeline" divided>
              <PipelineStageField control={form.control} pipelines={pipelines} />
              {canAssignOwner ? <OwnerField control={form.control} /> : null}
            </CrmFormSection>

            <CustomFieldsSection
              entity="deal"
              values={customFields}
              onChange={setCustomFields}
              pipelineId={pipelineId}
              stageId={stageId}
            />

            {moreDetails ? (
              <CrmFormSection title="Details" divided>
                <PriorityField control={form.control} />
                <TextField name="source" label="Source" />
                <TextareaField name="notes" label="Notes" />
              </CrmFormSection>
            ) : (
              <button
                type="button"
                aria-expanded={false}
                className="inline-flex items-center gap-1 text-caption font-medium text-ink-secondary transition-colors hover:text-ink"
                onClick={() => setMoreDetails(true)}
              >
                <ChevronDown className="size-3.5" aria-hidden />
                More details
                <span className="font-normal text-ink-muted">· priority, source, notes</span>
              </button>
            )}
          </Form>
        </div>
      </QuickCreateDrawer>
    </FormScope>
  );
}

type DealControl = Control<DealCreateInput, unknown, DealCreateValues>;

async function searchCustomers(q: string) {
  const res = await crmApi.listCustomers(new URLSearchParams({ limit: "20", q }));
  return (res.data ?? []).map((c) => ({
    value: c.id,
    label: c.fullName,
    description: c.email ?? undefined,
  }));
}

function CustomerField({ control }: { control: DealControl }) {
  const { field, fieldState } = useController({ control, name: "customerId" });
  const error = fieldState.error?.message;
  return (
    <FormFieldSlot label="Customer" required error={error}>
      <div data-invalid={error ? "true" : undefined}>
        <SearchableSelect
          value={field.value || null}
          onChange={(v) => {
            field.onChange(v ?? "");
            field.onBlur();
          }}
          onSearch={searchCustomers}
          placeholder="Search customers…"
          searchPlaceholder="Type a name or email…"
          emptyText="No matching customers found."
          error={Boolean(error)}
        />
      </div>
    </FormFieldSlot>
  );
}

function PipelineStageField({ control, pipelines }: { control: DealControl; pipelines: Pipeline[] }) {
  const pipeline = useController({ control, name: "pipelineId" });
  const stage = useController({ control, name: "stageId" });
  return (
    <PipelineStagePickers
      pipelines={pipelines}
      pipelineId={pipeline.field.value}
      stageId={stage.field.value}
      onPipelineChange={(pid, sid) => {
        pipeline.field.onChange(pid === "none" ? "" : pid);
        stage.field.onChange(sid === "none" ? "" : sid);
      }}
      onStageChange={(sid) => stage.field.onChange(sid === "none" ? "" : sid)}
    />
  );
}

function OwnerField({ control }: { control: DealControl }) {
  const { field } = useController({ control, name: "ownerUserId" });
  return <UserPicker value={field.value} onChange={field.onChange} label="Owner" />;
}

function PriorityField({ control }: { control: DealControl }) {
  const { field } = useController({ control, name: "priority" });
  return <PriorityToggle value={field.value} onChange={field.onChange} />;
}