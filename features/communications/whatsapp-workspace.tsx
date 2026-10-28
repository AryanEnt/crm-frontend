"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Phone, Search, Send, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { LeadCombobox } from "@/components/forms/entity-pickers";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { Label } from "@/components/ui/label";
import { leadHref } from "@/features/activities/activity-href";
import { useAuth } from "@/features/auth/auth-provider";
import {
  crmApi,
  type WhatsAppConversation,
  type WhatsAppMessage,
} from "@/lib/api/crm";
import { cn } from "@/lib/utils";
import { WhatsAppCallDialog } from "./whatsapp-call-dialog";

function formatWhen(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function peerPhone(c: Pick<WhatsAppConversation, "direction" | "fromNumber" | "toNumber">) {
  return c.direction === "inbound" ? c.fromNumber : c.toNumber;
}

export function WhatsAppWorkspace() {
  const { can } = useAuth();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [q, setQ] = React.useState("");
  const [selectedKey, setSelectedKey] = React.useState(params.get("c") || "");
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [callOpen, setCallOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const threadEndRef = React.useRef<HTMLDivElement>(null);

  const accountsQ = useQuery({
    queryKey: ["communication-accounts", "meta_whatsapp"],
    queryFn: () => crmApi.listCommunicationAccounts("meta_whatsapp"),
    enabled: can("communications:view") || can("communications:send"),
  });
  const waAccounts = accountsQ.data ?? [];

  const listParams = React.useMemo(() => {
    const p = new URLSearchParams({ limit: "50" });
    if (q.trim()) p.set("q", q.trim());
    return p;
  }, [q]);

  const conversations = useQuery({
    queryKey: ["whatsapp-conversations", listParams.toString()],
    queryFn: () => crmApi.listWhatsAppConversations(listParams),
    refetchInterval: 15_000,
  });

  const messagesParams = React.useMemo(() => {
    const p = new URLSearchParams({ limit: "100", conversationKey: selectedKey });
    return p;
  }, [selectedKey]);

  const thread = useQuery({
    queryKey: ["whatsapp-messages", selectedKey],
    queryFn: () => crmApi.listWhatsAppMessages(messagesParams),
    enabled: !!selectedKey,
    refetchInterval: selectedKey ? 8_000 : false,
  });

  const selected = (conversations.data?.data ?? []).find((c) => c.conversationKey === selectedKey);
  const messagesAsc = React.useMemo(() => {
    const items = [...(thread.data?.data ?? [])];
    items.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
    return items;
  }, [thread.data?.data]);

  React.useEffect(() => {
    const c = params.get("c");
    if (c) setSelectedKey(c);
  }, [params]);

  React.useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesAsc.length, selectedKey]);

  const sendMutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("No conversation selected");
      const to = peerPhone(selected);
      return crmApi.sendWhatsApp({
        to,
        body: draft,
        mediaUrl: "",
        leadId: selected.leadId || undefined,
        customerId: selected.customerId || undefined,
        dealId: selected.dealId || undefined,
      });
    },
    onSuccess: () => {
      setDraft("");
      void qc.invalidateQueries({ queryKey: ["whatsapp-messages", selectedKey] });
      void qc.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      void qc.invalidateQueries({ queryKey: ["timeline"] });
      toast.success("Message sent");
    },
    onError: (err: Error) => toast.error(err.message || "Send failed"),
  });

  const newChatMutation = useMutation({
    mutationFn: (input: { leadId: string; to: string; body: string }) =>
      crmApi.sendWhatsApp({
        leadId: input.leadId,
        to: input.to,
        body: input.body,
        mediaUrl: "",
      }),
    onSuccess: (msg) => {
      setComposeOpen(false);
      setSelectedKey(msg.conversationKey);
      void qc.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      void qc.invalidateQueries({ queryKey: ["whatsapp-messages"] });
      toast.success("Conversation started");
    },
    onError: (err: Error) => toast.error(err.message || "Could not start chat"),
  });

  if (accountsQ.isLoading) return <LoadingState label="Loading WhatsApp…" />;

  if (waAccounts.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="WhatsApp" description="Message and call leads on WhatsApp" />
        <EmptyState
          icon={MessageCircle}
          title="No WhatsApp account connected"
          description="Connect your WhatsApp Business number in Settings — one click after your admin adds the Meta app env."
          actionLabel="Connect WhatsApp"
          onAction={() => {
            window.location.href = "/settings/whatsapp";
          }}
        />
      </div>
    );
  }

  const accountLabel = waAccounts[0]?.displayIdentifier || waAccounts[0]?.name || "WhatsApp";

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-3">
      <PageHeader
        title="WhatsApp"
        description={accountLabel}
        actions={
          can("communications:send") ? (
            <Button onClick={() => setComposeOpen(true)}>New chat</Button>
          ) : null
        }
      />

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface md:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        {/* Conversation list */}
        <div className={cn("flex min-h-[320px] flex-col border-border md:border-r", selectedKey ? "hidden md:flex" : "flex")}>
          <div className="border-b border-border p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-foreground-subtle" />
              <Input
                className="pl-8"
                placeholder="Search chats"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search WhatsApp conversations"
              />
            </div>
          </div>
          <div className="crm-scroll min-h-0 flex-1 overflow-y-auto">
            {conversations.isLoading ? (
              <LoadingState />
            ) : conversations.isError ? (
              <ErrorState onRetry={() => void conversations.refetch()} />
            ) : (conversations.data?.data ?? []).length === 0 ? (
              <EmptyState
                className="m-4"
                icon={MessageCircle}
                title="No conversations yet"
                description="Messages you send or receive on WhatsApp show up here."
                actionLabel={can("communications:send") ? "New chat" : undefined}
                onAction={can("communications:send") ? () => setComposeOpen(true) : undefined}
              />
            ) : (
              <ul className="divide-y divide-border">
                {(conversations.data?.data ?? []).map((c) => (
                  <ConversationRow
                    key={c.conversationKey}
                    conversation={c}
                    active={c.conversationKey === selectedKey}
                    onClick={() => setSelectedKey(c.conversationKey)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Thread */}
        <section
          className={cn("flex min-h-[320px] flex-col", !selectedKey ? "hidden md:flex" : "flex")}
          aria-label="WhatsApp conversation"
        >
          {!selectedKey ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <MessageCircle className="size-8 text-foreground-subtle" />
              <p className="text-sm font-medium text-foreground">Select a conversation</p>
              <p className="max-w-xs text-xs text-foreground-muted">
                Chat with leads on WhatsApp, request call permission, and place WhatsApp calls from here.
              </p>
            </div>
          ) : thread.isLoading ? (
            <LoadingState />
          ) : thread.isError ? (
            <ErrorState onRetry={() => void thread.refetch()} />
          ) : (
            <>
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    className="mb-1 text-xs text-foreground-muted md:hidden"
                    onClick={() => setSelectedKey("")}
                  >
                    ← Back
                  </button>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {selected ? peerPhone(selected) : selectedKey}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
                    {selected?.leadId ? (
                      <Link href={leadHref(selected.leadId)} className="inline-flex items-center gap-1 text-brand hover:underline">
                        Open lead <ExternalLink className="size-3" />
                      </Link>
                    ) : (
                      <span>Unlinked contact</span>
                    )}
                  </div>
                </div>
                {can("communications:send") && selected ? (
                  <Button size="sm" variant="outline" onClick={() => setCallOpen(true)}>
                    <Phone className="size-3.5" />
                    Call
                  </Button>
                ) : null}
              </header>

              <div className="crm-scroll min-h-0 flex-1 space-y-2 overflow-y-auto bg-surface-muted/40 px-4 py-4">
                {messagesAsc.length === 0 ? (
                  <p className="py-8 text-center text-sm text-foreground-muted">No messages in this chat yet.</p>
                ) : (
                  messagesAsc.map((m) => <Bubble key={m.id} message={m} />)
                )}
                <div ref={threadEndRef} />
              </div>

              {can("communications:send") ? (
                <form
                  className="flex items-end gap-2 border-t border-border p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!draft.trim() || sendMutation.isPending) return;
                    sendMutation.mutate();
                  }}
                >
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a WhatsApp message…"
                    aria-label="Message"
                    className="flex-1"
                  />
                  <Button type="submit" disabled={!draft.trim() || sendMutation.isPending}>
                    <Send className="size-3.5" />
                    Send
                  </Button>
                </form>
              ) : null}
            </>
          )}
        </section>
      </div>

      <NewChatDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        pending={newChatMutation.isPending}
        onSubmit={(input) => newChatMutation.mutate(input)}
      />

      {selected ? (
        <WhatsAppCallDialog
          open={callOpen}
          onOpenChange={setCallOpen}
          context={{
            leadId: selected.leadId || undefined,
            customerId: selected.customerId || undefined,
            dealId: selected.dealId || undefined,
            defaultPhone: peerPhone(selected),
          }}
          accounts={waAccounts}
        />
      ) : null}
    </div>
  );
}

function ConversationRow({
  conversation: c,
  active,
  onClick,
}: {
  conversation: WhatsAppConversation;
  active: boolean;
  onClick: () => void;
}) {
  const phone = peerPhone(c);
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors",
          active ? "bg-brand-soft" : "hover:bg-surface-muted",
        )}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">{phone || "Unknown"}</span>
          <span className="shrink-0 text-[11px] text-foreground-subtle">{formatWhen(c.occurredAt)}</span>
        </div>
        <p className="truncate text-xs text-foreground-muted">
          {c.direction === "outbound" ? "You: " : ""}
          {c.body || "—"}
        </p>
      </button>
    </li>
  );
}

function Bubble({ message: m }: { message: WhatsAppMessage }) {
  const outbound = m.direction === "outbound";
  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-xs",
          outbound
            ? "rounded-br-md bg-brand text-primary-foreground"
            : "rounded-bl-md border border-border bg-surface text-foreground",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{m.body || (m.mediaUrl ? "[attachment]" : "")}</p>
        <p
          className={cn(
            "mt-1 text-[10px]",
            outbound ? "text-primary-foreground/70" : "text-foreground-subtle",
          )}
        >
          {formatWhen(m.occurredAt)}
          {outbound && m.status ? ` · ${m.status}` : ""}
        </p>
      </div>
    </div>
  );
}

function NewChatDialog({
  open,
  onOpenChange,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pending: boolean;
  onSubmit: (input: { leadId: string; to: string; body: string }) => void;
}) {
  const [leadId, setLeadId] = React.useState("");
  const [to, setTo] = React.useState("");
  const [body, setBody] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setLeadId("");
      setTo("");
      setBody("");
    }
  }, [open]);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>New WhatsApp chat</ModalTitle>
          <ModalDescription>
            Pick a lead, confirm the phone number, and send the first message.
          </ModalDescription>
        </ModalHeader>
        <div className="space-y-3 px-1 py-2">
          <div className="space-y-1">
            <Label>Lead</Label>
            <LeadCombobox
              value={leadId}
              onChange={(id, option) => {
                setLeadId(id ?? "");
                if (option?.phone) setTo(option.phone);
              }}
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wa-new-to">Phone</Label>
            <Input id="wa-new-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="+61…" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wa-new-body">Message</Label>
            <Input
              id="wa-new-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi, following up on…"
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!leadId || !to.trim() || !body.trim() || pending}
            onClick={() => onSubmit({ leadId, to: to.trim(), body: body.trim() })}
          >
            Start chat
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
