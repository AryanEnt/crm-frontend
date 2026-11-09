"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleOff, FileText, Mail, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { emailApi, type EmailTemplate } from "@/lib/api/email";
import {
  htmlToPlain,
  TEMPLATE_VAR_KEYS,
  TemplateMessageEditor,
  textToHtml,
} from "@/features/email/template-message-editor";

const SAMPLE_FOLLOW_UP = {
  name: "Follow-up after first call",
  subject: "Following up on {{company_name}}",
  body: `Hi {{first_name}},

Thank you for taking the time to speak with me today.

I wanted to follow up regarding {{company_name}} and share the next steps we discussed. If anything has changed on your side, reply to this email and I will adjust.`,
  signature: `Best regards,
{{lead_owner}}`,
};

type FormState = { name: string; subject: string; bodyHtml: string; signatureHtml: string };

function emptyForm(): FormState {
  return { name: "", subject: "", bodyHtml: "", signatureHtml: "" };
}

function sampleForm(): FormState {
  return {
    name: SAMPLE_FOLLOW_UP.name,
    subject: SAMPLE_FOLLOW_UP.subject,
    bodyHtml: textToHtml(SAMPLE_FOLLOW_UP.body),
    signatureHtml: textToHtml(SAMPLE_FOLLOW_UP.signature),
  };
}

function snippet(html: string) {
  const text = htmlToPlain(html).replace(/\s+/g, " ");
  if (text.length <= 120) return text;
  return `${text.slice(0, 117)}…`;
}

export function EmailTemplatesView() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["email-templates", "manage"],
    queryFn: () => emailApi.listTemplates({ includeInactive: true }),
  });
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [editorKey, setEditorKey] = React.useState(0);

  const templates = list.data ?? [];
  const hasSample = templates.some((t) => t.name === SAMPLE_FOLLOW_UP.name);

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const openCreate = (seed?: FormState) => {
    setEditingId(null);
    setForm(seed ?? emptyForm());
    setEditorKey((k) => k + 1);
    setEditorOpen(true);
  };

  const openEdit = (t: EmailTemplate) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      subject: t.subject,
      bodyHtml: t.bodyHtml,
      signatureHtml: t.signatureHtml ?? "",
    });
    setEditorKey((k) => k + 1);
    setEditorOpen(true);
  };

  const save = useMutation({
    mutationFn: (body: FormState) => {
      const payload = {
        name: body.name.trim(),
        subject: body.subject.trim(),
        bodyHtml: body.bodyHtml,
        signatureHtml: body.signatureHtml,
        category: "general",
        variables: TEMPLATE_VAR_KEYS,
      };
      return editingId ? emailApi.updateTemplate(editingId, payload) : emailApi.createTemplate(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? "Template updated" : "Template saved");
      closeEditor();
      void qc.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addSample = useMutation({
    mutationFn: () => {
      const s = sampleForm();
      return emailApi.createTemplate({
        name: s.name,
        subject: s.subject,
        bodyHtml: s.bodyHtml,
        signatureHtml: s.signatureHtml,
        category: "general",
        variables: TEMPLATE_VAR_KEYS,
      });
    },
    onSuccess: () => {
      toast.success("Starter template added");
      void qc.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setActive = useMutation({
    mutationFn: ({ template, isActive }: { template: EmailTemplate; isActive: boolean }) =>
      emailApi.updateTemplate(template.id, {
        name: template.name,
        subject: template.subject,
        bodyHtml: template.bodyHtml,
        signatureHtml: template.signatureHtml ?? "",
        category: template.category || "general",
        variables: template.variables?.length ? template.variables : TEMPLATE_VAR_KEYS,
        isActive,
      }),
    onSuccess: (_data, { isActive }) => {
      toast.success(isActive ? "Template activated" : "Template deactivated");
      void qc.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => emailApi.deleteTemplate(id),
    onSuccess: (_data, id) => {
      toast.success("Template deleted");
      setDeleteId(null);
      if (editingId === id) closeEditor();
      void qc.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (list.isLoading) return <LoadingState label="Loading templates…" />;
  if (list.isError) return <ErrorState onRetry={() => void list.refetch()} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Email templates"
        description="Write emails your team can reuse. They pick one when composing, then can edit before sending."
        actions={
          <Button onClick={() => openCreate()}>
            <Plus />
            New template
          </Button>
        }
      />

      {templates.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            icon={Mail}
            title="No templates yet"
            description="Start from the sample follow-up, or write a new email."
            actionLabel="Write a template"
            onAction={() => openCreate()}
          />
          <div className="border-t border-border px-4 py-3">
            <SampleRow
              onUse={() => openCreate(sampleForm())}
              onAdd={() => addSample.mutate()}
              adding={addSample.isPending}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {!hasSample ? (
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <SampleRow
                onUse={() => openCreate(sampleForm())}
                onAdd={() => addSample.mutate()}
                adding={addSample.isPending}
              />
            </div>
          ) : null}
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {templates.map((t) => (
              <li
                key={t.id}
                className={cn(
                  "flex items-start justify-between gap-4 px-4 py-4",
                  !t.isActive && "bg-surface-muted/40",
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn("text-sm font-medium", !t.isActive && "text-foreground-muted")}>
                      {t.name}
                    </p>
                    <StatusBadge tone={t.isActive ? "success" : "neutral"}>
                      {t.isActive ? "Active" : "Inactive"}
                    </StatusBadge>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-foreground-muted">{t.subject || "No subject"}</p>
                  {t.bodyHtml ? (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-foreground-subtle">
                      {snippet(t.bodyHtml)}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                    <Pencil />
                    Edit
                  </Button>
                  {t.isActive ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={setActive.isPending}
                      onClick={() => setActive.mutate({ template: t, isActive: false })}
                    >
                      <CircleOff />
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={setActive.isPending}
                      onClick={() => setActive.mutate({ template: t, isActive: true })}
                    >
                      Activate
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setDeleteId(t.id)}>
                    <Trash2 />
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        open={editorOpen}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <ModalContent
          className="flex h-[min(92dvh,840px)] max-h-[92dvh] w-[calc(100%-1rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100%-2rem)]"
          showClose
        >
          <ModalHeader className="shrink-0 border-b border-border px-5 py-4 pr-12">
            <ModalTitle>{editingId ? "Edit template" : "New template"}</ModalTitle>
            <ModalDescription className="sr-only">
              Write the email your team will send to clients.
            </ModalDescription>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="grid min-w-0 flex-1 gap-1.5">
                <Label htmlFor="tpl-name">Template name</Label>
                <Input
                  id="tpl-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Follow-up after first call"
                />
              </div>
              {!editingId ? (
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => {
                    setForm(sampleForm());
                    setEditorKey((k) => k + 1);
                  }}
                >
                  <Sparkles />
                  Use sample
                </Button>
              ) : null}
            </div>
          </ModalHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 sm:px-5 sm:py-4">
            <TemplateMessageEditor
              key={editorKey}
              subject={form.subject}
              onSubjectChange={(subject) => setForm((f) => ({ ...f, subject }))}
              bodyHtml={form.bodyHtml}
              onBodyChange={(bodyHtml) => setForm((f) => ({ ...f, bodyHtml }))}
              signatureHtml={form.signatureHtml}
              onSignatureChange={(signatureHtml) => setForm((f) => ({ ...f, signatureHtml }))}
            />
          </div>

          <ModalFooter className="shrink-0 border-t border-border px-5 py-3">
            <Button type="button" variant="ghost" onClick={closeEditor}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={save.isPending || form.name.trim() === ""}
              onClick={() => save.mutate(form)}
            >
              {editingId ? "Save changes" : "Save template"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete this template?"
        description="This permanently removes it. Prefer Deactivate if you might need it again."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (deleteId) void remove.mutateAsync(deleteId);
        }}
      />
    </div>
  );
}

function SampleRow({
  onUse,
  onAdd,
  adding,
}: {
  onUse: () => void;
  onAdd: () => void;
  adding: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <FileText className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{SAMPLE_FOLLOW_UP.name}</p>
          <p className="text-xs text-foreground-muted">Ready-made first-call follow-up</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" onClick={onUse}>
          Open in editor
        </Button>
        <Button size="sm" onClick={onAdd} disabled={adding}>
          Add to team
        </Button>
      </div>
    </div>
  );
}
