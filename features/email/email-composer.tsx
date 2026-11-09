"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bold, Italic, Link2, List, Paperclip, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import {
  emailApi,
  type ComposeAttachmentPayload,
  type EmailAccount,
  type EmailMessage,
  type EmailTemplate,
} from "@/lib/api/email";
import { ApiError } from "@/types/api";
import { cn } from "@/lib/utils";

const MAX_ATTACH_BYTES = 15 * 1024 * 1024;
const MAX_ATTACH_COUNT = 10;

type PendingAttachment = {
  id: string;
  file: File;
};

async function fileToComposeAttachment(file: File): Promise<ComposeAttachmentPayload> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return {
    filename: file.name || "attachment",
    mimeType: file.type || "application/octet-stream",
    contentBase64: btoa(binary),
  };
}

function formatAttachSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export type ComposerContext = {
  leadId?: string;
  customerId?: string;
  dealId?: string;
  to?: string[];
  subject?: string;
  threadId?: string;
  inReplyTo?: string;
  quoteHtml?: string;
  mode?: "compose" | "reply" | "forward";
};

function splitAddrs(v: string) {
  return v
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

export function EmailComposer({
  open,
  onOpenChange,
  context,
  account,
  fullscreen = false,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: ComposerContext;
  account?: EmailAccount | null;
  fullscreen?: boolean;
  /** Called after a successful send (not drafts / failed sends). */
  onSent?: (msg: EmailMessage) => void;
}) {
  const qc = useQueryClient();
  const editorRef = React.useRef<HTMLDivElement>(null);
  const attachInputRef = React.useRef<HTMLInputElement>(null);
  const [to, setTo] = React.useState((context.to ?? []).join(", "));
  const [cc, setCc] = React.useState("");
  const [bcc, setBcc] = React.useState("");
  const [showCc, setShowCc] = React.useState(false);
  const [subject, setSubject] = React.useState(context.subject ?? "");
  const [draftId, setDraftId] = React.useState<string | null>(null);
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">("idle");
  const [preview, setPreview] = React.useState<string | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const [attachments, setAttachments] = React.useState<PendingAttachment[]>([]);
  const [templateId, setTemplateId] = React.useState("");
  const saveTimer = React.useRef<number | null>(null);

  const templatesQuery = useQuery({
    queryKey: ["email-templates"],
    queryFn: () => emailApi.listTemplates(),
    enabled: open,
  });

  React.useEffect(() => {
    if (!open) return;
    setTo((context.to ?? []).join(", "));
    setSubject(context.subject ?? "");
    setDraftId(null);
    setSaveState("idle");
    setShowPreview(false);
    setAttachments([]);
    setTemplateId("");
    window.setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = context.quoteHtml
          ? `<p><br/></p><blockquote class="border-l-2 border-border pl-3 text-foreground-muted">${context.quoteHtml}</blockquote>`
          : "";
      }
    }, 0);
  }, [open, context.to, context.subject, context.threadId, context.inReplyTo, context.quoteHtml]);

  const addFiles = (list: FileList | File[] | null) => {
    if (!list || list.length === 0) return;
    const next = [...attachments];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_ATTACH_COUNT) {
        toast.error(`You can attach up to ${MAX_ATTACH_COUNT} files`);
        break;
      }
      if (file.size > MAX_ATTACH_BYTES) {
        toast.error(`“${file.name}” is over 15 MB`);
        continue;
      }
      next.push({ id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`, file });
    }
    setAttachments(next);
  };

  const html = () => editorRef.current?.innerHTML ?? "";

  const persistDraft = React.useCallback(async () => {
    const bodyHtml = html();
    if (!to && !subject && !bodyHtml.replace(/<[^>]+>/g, "").trim()) return;
    setSaveState("saving");
    try {
      if (!draftId) {
        const created = await emailApi.compose({
          accountId: account?.id,
          to: splitAddrs(to),
          cc: splitAddrs(cc),
          bcc: splitAddrs(bcc),
          subject,
          bodyHtml,
          leadId: context.leadId,
          customerId: context.customerId,
          dealId: context.dealId,
          threadId: context.threadId,
          inReplyTo: context.inReplyTo,
          send: false,
        });
        setDraftId(created.id);
      } else {
        await emailApi.patchDraft(draftId, {
          to: splitAddrs(to),
          cc: splitAddrs(cc),
          bcc: splitAddrs(bcc),
          subject,
          bodyHtml,
        });
      }
      setSaveState("saved");
    } catch {
      setSaveState("idle");
    }
  }, [account?.id, bcc, cc, context, draftId, subject, to]);

  const scheduleSave = () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void persistDraft();
    }, 1200);
  };

  const sendMut = useMutation({
    mutationFn: async () => {
      const bodyHtml = html();
      const prev = await emailApi.preview({
        subject,
        bodyHtml,
        leadId: context.leadId,
        customerId: context.customerId,
      });
      if (!prev.canSend) {
        throw new ApiError(`Unresolved variables: ${(prev.unresolved ?? []).join(", ")}`, {
          status: 400,
          code: "unresolved_variables",
        });
      }
      const outboundAttachments =
        attachments.length > 0
          ? await Promise.all(attachments.map((a) => fileToComposeAttachment(a.file)))
          : [];
      // Drafts don't carry files yet — send a fresh message when attaching.
      if (draftId && outboundAttachments.length === 0) {
        await emailApi.patchDraft(draftId, {
          to: splitAddrs(to),
          cc: splitAddrs(cc),
          bcc: splitAddrs(bcc),
          subject: prev.subject,
          bodyHtml: prev.bodyHtml,
        });
        return emailApi.send(draftId);
      }
      return emailApi.compose({
        accountId: account?.id,
        to: splitAddrs(to),
        cc: splitAddrs(cc),
        bcc: splitAddrs(bcc),
        subject: prev.subject,
        bodyHtml: prev.bodyHtml,
        leadId: context.leadId,
        customerId: context.customerId,
        dealId: context.dealId,
        threadId: context.threadId,
        inReplyTo: context.inReplyTo,
        send: true,
        attachments: outboundAttachments.length > 0 ? outboundAttachments : undefined,
      });
    },
    onSuccess: (msg: EmailMessage) => {
      if (msg.status === "failed") {
        toast.error(
          "Couldn't send the email. Ask your Team Lead to check the mailbox connection in Team Email, then try again.",
        );
        return;
      }
      if (!onSent) toast.success("Email sent");
      void qc.invalidateQueries({ queryKey: ["email-threads"] });
      void qc.invalidateQueries({ queryKey: ["email-thread"] });
      void qc.invalidateQueries({ queryKey: ["timeline"] });
      onOpenChange(false);
      onSent?.(msg);
    },
    onError: (err: Error) => {
      toast.error(
        err instanceof ApiError ? err.message : "Couldn't send the email. Try again.",
      );
    },
  });

  const insertTemplate = (t: EmailTemplate) => {
    setSubject(t.subject);
    if (editorRef.current) {
      editorRef.current.innerHTML = t.bodyHtml;
    }
    scheduleSave();
  };

  const runPreview = async () => {
    const prev = await emailApi.preview({
      subject,
      bodyHtml: html(),
      leadId: context.leadId,
      customerId: context.customerId,
    });
    setPreview(prev.bodyHtml);
    setShowPreview(true);
    if (!prev.canSend) {
      toast.message(`Unresolved: ${(prev.unresolved ?? []).join(", ")}`);
    }
  };

  const fromLabel = account
    ? `${account.displayName || "Me"} <${account.emailAddress}>`
    : "Connect a mailbox to send";

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        className={cn(
          "max-h-[92vh] overflow-hidden p-0",
          fullscreen ? "max-w-4xl" : "max-w-2xl",
        )}
        aria-describedby={undefined}
      >
        <ModalHeader className="border-b border-border px-4 py-3">
          <ModalTitle className="text-base">
            {context.mode === "reply"
              ? "Reply"
              : context.mode === "forward"
                ? "Forward"
                : "Compose email"}
          </ModalTitle>
          <ModalDescription className="text-xs">
            Sends from your connected mailbox. The From address cannot be changed.
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-3 overflow-y-auto px-4 py-3">
          <div className="grid gap-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-foreground-subtle">From</Label>
            <p className="rounded-md bg-surface-muted px-2.5 py-1.5 text-sm">{fromLabel}</p>
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-to">To</Label>
              {!showCc ? (
                <button
                  type="button"
                  className="text-xs text-foreground-muted hover:text-foreground"
                  onClick={() => setShowCc(true)}
                >
                  Cc / Bcc
                </button>
              ) : null}
            </div>
            <Input
              id="email-to"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                scheduleSave();
              }}
              placeholder="name@company.com"
              autoComplete="off"
            />
          </div>
          {showCc ? (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="email-cc">Cc</Label>
                <Input
                  id="email-cc"
                  value={cc}
                  onChange={(e) => {
                    setCc(e.target.value);
                    scheduleSave();
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email-bcc">Bcc</Label>
                <Input
                  id="email-bcc"
                  value={bcc}
                  onChange={(e) => {
                    setBcc(e.target.value);
                    scheduleSave();
                  }}
                />
              </div>
            </>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                scheduleSave();
              }}
            />
          </div>

          <div className="overflow-hidden rounded-md border border-border">
            <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface-muted/60 px-1 py-1">
              <ToolbarBtn label="Bold" onClick={() => exec("bold")}>
                <Bold className="size-3.5" />
              </ToolbarBtn>
              <ToolbarBtn label="Italic" onClick={() => exec("italic")}>
                <Italic className="size-3.5" />
              </ToolbarBtn>
              <ToolbarBtn label="List" onClick={() => exec("insertUnorderedList")}>
                <List className="size-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                label="Link"
                onClick={() => {
                  const href = window.prompt("Link URL");
                  if (href) exec("createLink", href);
                }}
              >
                <Link2 className="size-3.5" />
              </ToolbarBtn>
              <span className="mx-1 h-4 w-px bg-border" />
              <select
                aria-label="Email template"
                className="h-7 max-w-[180px] rounded-md border-0 bg-transparent text-xs"
                value={templateId}
                onChange={(e) => {
                  const id = e.target.value;
                  setTemplateId(id);
                  const t = templatesQuery.data?.find((x) => x.id === id);
                  if (t) insertTemplate(t);
                }}
              >
                <option value="">Select template</option>
                {(templatesQuery.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Button type="button" size="sm" variant="ghost" onClick={() => void runPreview()}>
                <Eye className="size-3.5" />
                Preview
              </Button>
              <span className="ml-auto pr-2 text-[11px] text-foreground-subtle">
                {saveState === "saving"
                  ? "Saving…"
                  : saveState === "saved"
                    ? "Draft saved"
                    : null}
              </span>
            </div>
            <div
              ref={editorRef}
              role="textbox"
              aria-label="Message"
              contentEditable
              className="min-h-[180px] px-3 py-2 text-sm leading-relaxed outline-none"
              onInput={scheduleSave}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  sendMut.mutate();
                }
              }}
            />
          </div>
          {attachments.length > 0 ? (
            <ul className="space-y-1 rounded-md border border-border bg-surface-muted/30 p-2">
              {attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm text-foreground"
                >
                  <Paperclip className="size-3.5 shrink-0 text-foreground-muted" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">{a.file.name}</span>
                  <span className="shrink-0 text-[11px] text-foreground-subtle">
                    {formatAttachSize(a.file.size)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${a.file.name}`}
                    className="inline-flex size-7 items-center justify-center rounded-md text-foreground-muted hover:bg-surface hover:text-foreground"
                    onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {showPreview ? (
            <div className="rounded-md border border-border bg-surface-muted/40 p-3 text-sm">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-foreground-subtle">
                Personalization preview
              </p>
              <div dangerouslySetInnerHTML={{ __html: preview || "" }} />
            </div>
          ) : (
            <p className="text-[11px] text-foreground-subtle">
              Variables like {"{{first_name}}"} resolve from the Lead or Customer before send.
            </p>
          )}
        </div>

        <ModalFooter className="border-t border-border px-4 py-3">
          <div className="mr-auto flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={sendMut.isPending || attachments.length >= MAX_ATTACH_COUNT}
              onClick={() => attachInputRef.current?.click()}
            >
              <Paperclip className="size-3.5" />
              Attach files
            </Button>
            <input
              ref={attachInputRef}
              type="file"
              multiple
              className="hidden"
              tabIndex={-1}
              aria-hidden
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt,image/*,application/pdf"
              onChange={(e) => {
                addFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />
            {attachments.length > 0 ? (
              <span className="text-xs text-foreground-muted">
                {attachments.length} file{attachments.length === 1 ? "" : "s"} · max 15 MB each
              </span>
            ) : (
              <span className="text-xs text-foreground-muted">PDF, images, Office docs</span>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              await persistDraft();
              toast.success("Draft saved");
              onOpenChange(false);
            }}
          >
            Save draft
          </Button>
          <Button type="button" disabled={!account || sendMut.isPending} onClick={() => sendMut.mutate()}>
            {sendMut.isPending ? "Sending…" : "Send"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function ToolbarBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="rounded p-1.5 text-foreground-muted hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
