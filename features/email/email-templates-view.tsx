"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { emailApi, type EmailTemplate } from "@/lib/api/email";

export function EmailTemplatesView() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["email-templates"], queryFn: () => emailApi.listTemplates() });
  const [name, setName] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [category, setCategory] = React.useState("general");

  const create = useMutation({
    mutationFn: () =>
      emailApi.createTemplate({
        name,
        subject,
        bodyHtml: body.replace(/\n/g, "<br/>"),
        category,
        variables: ["first_name", "last_name", "company_name", "lead_owner", "phone"],
      }),
    onSuccess: () => {
      toast.success("Template saved");
      setName("");
      setSubject("");
      setBody("");
      void qc.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => emailApi.deleteTemplate(id),
    onSuccess: () => {
      toast.success("Template deleted");
      void qc.invalidateQueries({ queryKey: ["email-templates"] });
    },
  });

  if (list.isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email templates"
        description="Shared templates for the team. Insert them from the composer. Gmail drafts stay separate."
      />
      <form
        className="grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="tpl-name">Name</Label>
          <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tpl-cat">Category</Label>
          <Input id="tpl-cat" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div className="grid gap-1.5 md:col-span-2">
          <Label htmlFor="tpl-subject">Subject</Label>
          <Input id="tpl-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="grid gap-1.5 md:col-span-2">
          <Label htmlFor="tpl-body">Body</Label>
          <textarea
            id="tpl-body"
            className="min-h-[140px] rounded-md border border-border bg-surface px-3 py-2 text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Hi {{first_name}},\n\nI wanted to follow up regarding {{company_name}}."}
          />
        </div>
        <div>
          <Button type="submit" disabled={create.isPending}>
            Save template
          </Button>
        </div>
      </form>

      {(list.data ?? []).length === 0 ? (
        <EmptyState title="No templates yet" description="Create the first team template." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {(list.data ?? []).map((t: EmailTemplate) => (
            <li key={t.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-foreground-muted">{t.subject}</p>
                <p className="mt-1 text-[11px] text-foreground-subtle">{t.category}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(t.id)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
