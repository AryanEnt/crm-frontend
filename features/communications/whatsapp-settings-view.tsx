"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Unplug } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi, type CommunicationAccount } from "@/lib/api/crm";
import { ApiError } from "@/types/api";
import { launchWhatsAppEmbeddedSignup, loadFacebookSdk } from "./meta-embedded-signup";

type ConnectForm = {
  name: string;
  displayIdentifier: string;
  externalAccountId: string;
  accessToken: string;
  appSecret: string;
  verifyToken: string;
  graphApiVersion: string;
};

const emptyForm = (): ConnectForm => ({
  name: "",
  displayIdentifier: "",
  externalAccountId: "",
  accessToken: "",
  appSecret: "",
  verifyToken: "",
  graphApiVersion: "v21.0",
});

export function WhatsAppSettingsView() {
  const { can, user } = useAuth();
  const qc = useQueryClient();
  const [manualOpen, setManualOpen] = React.useState(false);
  const [form, setForm] = React.useState<ConnectForm>(emptyForm);
  const [connecting, setConnecting] = React.useState(false);

  const canConnect = can("communications:send") || can("communications:manage");

  const configQ = useQuery({
    queryKey: ["whatsapp-connect-config"],
    queryFn: () => crmApi.whatsappConnectConfig(),
    enabled: canConnect || can("communications:view"),
  });

  const accountsQ = useQuery({
    queryKey: ["communication-accounts", "meta_whatsapp"],
    queryFn: () => crmApi.listCommunicationAccounts("meta_whatsapp"),
    enabled: can("communications:view") || canConnect,
  });

  const accounts = accountsQ.data ?? [];
  const mine = accounts.filter((a) => a.ownerUserId === user?.id);
  const shared = accounts.filter((a) => a.ownerUserId !== user?.id);
  const embeddedReady = !!configQ.data?.configured;

  React.useEffect(() => {
    if (!embeddedReady || !configQ.data) return;
    void loadFacebookSdk(configQ.data.appId, configQ.data.graphApiVersion).catch(() => {
      // Button click will surface the error.
    });
  }, [embeddedReady, configQ.data]);

  const connectManual = useMutation({
    mutationFn: () => crmApi.connectWhatsAppAccount(form),
    onSuccess: () => {
      toast.success("WhatsApp connected");
      setManualOpen(false);
      setForm(emptyForm());
      void qc.invalidateQueries({ queryKey: ["communication-accounts"] });
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : err.message || "Couldn't connect WhatsApp");
    },
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => crmApi.disconnectCommunicationAccount(id),
    onSuccess: () => {
      toast.success("WhatsApp disconnected");
      void qc.invalidateQueries({ queryKey: ["communication-accounts"] });
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : "Couldn't disconnect");
    },
  });

  const startEmbedded = async () => {
    if (!configQ.data?.configured) return;
    setConnecting(true);
    try {
      await loadFacebookSdk(configQ.data.appId, configQ.data.graphApiVersion);
      const result = await launchWhatsAppEmbeddedSignup(configQ.data.configId);
      await crmApi.completeWhatsAppEmbeddedSignup({
        code: result.code,
        phoneNumberId: result.phoneNumberId,
        wabaId: result.wabaId,
        displayPhoneNumber: result.displayPhoneNumber ?? "",
      });
      toast.success("WhatsApp connected");
      void qc.invalidateQueries({ queryKey: ["communication-accounts"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't connect WhatsApp");
    } finally {
      setConnecting(false);
    }
  };

  if (accountsQ.isLoading || configQ.isLoading) return <LoadingState label="Loading WhatsApp accounts…" />;
  if (accountsQ.isError) return <ErrorState onRetry={() => void accountsQ.refetch()} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="WhatsApp accounts"
        description={
          embeddedReady
            ? "Connect your WhatsApp Business number in one click — same Meta app the workspace already uses."
            : "Connect a Meta WhatsApp Business Cloud API number to message and call from Aurora."
        }
        actions={
          canConnect ? (
            embeddedReady ? (
              <Button disabled={connecting} onClick={() => void startEmbedded()}>
                {connecting ? "Connecting…" : "Connect WhatsApp"}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setForm(emptyForm());
                  setManualOpen(true);
                }}
              >
                Connect WhatsApp
              </Button>
            )
          ) : null
        }
      />

      {!embeddedReady && can("communications:manage") ? (
        <div className="rounded-lg border border-warning-border bg-warning-soft/40 px-4 py-3 text-sm text-foreground">
          <p className="font-medium">One-click connect is not set up yet</p>
          <p className="mt-1 text-xs text-foreground-muted">
            Add <code className="rounded bg-surface px-1">META_APP_ID</code>,{" "}
            <code className="rounded bg-surface px-1">META_APP_SECRET</code>,{" "}
            <code className="rounded bg-surface px-1">META_WHATSAPP_CONFIG_ID</code>, and{" "}
            <code className="rounded bg-surface px-1">META_WHATSAPP_VERIFY_TOKEN</code> to the API
            env, then restart. Sales executives will only need to click Connect.
          </p>
        </div>
      ) : null}

      {accounts.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No WhatsApp account connected"
          description={
            embeddedReady
              ? "Click Connect WhatsApp, sign in with Meta, and pick the business number you want to use."
              : "Ask an admin to finish Meta app setup, or connect with Cloud API credentials."
          }
          actionLabel={canConnect ? "Connect WhatsApp" : undefined}
          onAction={
            canConnect
              ? () => {
                  if (embeddedReady) void startEmbedded();
                  else setManualOpen(true);
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {mine.length > 0 ? (
            <AccountSection
              title="Your accounts"
              accounts={mine}
              canDisconnect
              disconnectingId={disconnect.isPending ? disconnect.variables : null}
              onDisconnect={(id) => disconnect.mutate(id)}
            />
          ) : null}
          {shared.length > 0 ? (
            <AccountSection
              title="Shared workspace accounts"
              accounts={shared}
              canDisconnect={can("communications:manage")}
              disconnectingId={disconnect.isPending ? disconnect.variables : null}
              onDisconnect={(id) => disconnect.mutate(id)}
            />
          ) : null}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface-muted/40 px-4 py-3 text-sm text-foreground-muted">
        <p className="font-medium text-foreground">How it works</p>
        {embeddedReady ? (
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
            <li>Click <strong>Connect WhatsApp</strong></li>
            <li>Sign in to Meta / Facebook Business and choose (or create) your WhatsApp number</li>
            <li>Aurora stores the connection — you can message from the WhatsApp inbox right away</li>
          </ol>
        ) : (
          <p className="mt-2 text-xs">
            Admins configure the Meta app once in environment variables. After that, each SE
            connects their own number with one click (no tokens to paste).
          </p>
        )}
        <p className="mt-3 text-xs">
          Inbox:{" "}
          <Link href="/whatsapp" className="font-medium text-brand hover:underline">
            WhatsApp
          </Link>
          {embeddedReady && can("communications:manage") ? (
            <>
              {" · "}
              <button
                type="button"
                className="font-medium text-brand hover:underline"
                onClick={() => {
                  setForm(emptyForm());
                  setManualOpen(true);
                }}
              >
                Advanced: paste credentials
              </button>
            </>
          ) : null}
        </p>
      </div>

      <Modal open={manualOpen} onOpenChange={setManualOpen}>
        <ModalContent className="sm:max-w-lg">
          <ModalHeader>
            <ModalTitle>Connect with credentials</ModalTitle>
            <ModalDescription>
              Manual Cloud API setup. Prefer one-click Connect when the Meta app env is configured.
              Tokens are stored on the server and never shown again.
            </ModalDescription>
          </ModalHeader>
          <div className="crm-scroll max-h-[60vh] space-y-3 overflow-y-auto px-1 py-2">
            <Field label="Account name" value={form.name} onChange={(name) => setForm((f) => ({ ...f, name }))} placeholder="Sales WhatsApp" />
            <Field label="WhatsApp number (E.164)" value={form.displayIdentifier} onChange={(displayIdentifier) => setForm((f) => ({ ...f, displayIdentifier }))} placeholder="+61412345678" />
            <Field label="Phone number ID" value={form.externalAccountId} onChange={(externalAccountId) => setForm((f) => ({ ...f, externalAccountId }))} placeholder="Meta phone_number_id" />
            <Field label="Access token" value={form.accessToken} onChange={(accessToken) => setForm((f) => ({ ...f, accessToken }))} type="password" />
            <Field label="App secret" value={form.appSecret} onChange={(appSecret) => setForm((f) => ({ ...f, appSecret }))} type="password" />
            <Field label="Webhook verify token" value={form.verifyToken} onChange={(verifyToken) => setForm((f) => ({ ...f, verifyToken }))} type="password" />
            <Field label="Graph API version" value={form.graphApiVersion} onChange={(graphApiVersion) => setForm((f) => ({ ...f, graphApiVersion }))} placeholder="v21.0" />
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>Cancel</Button>
            <Button
              disabled={
                connectManual.isPending ||
                !form.name.trim() ||
                !form.displayIdentifier.trim() ||
                !form.externalAccountId.trim() ||
                !form.accessToken.trim() ||
                !form.appSecret.trim() ||
                !form.verifyToken.trim()
              }
              onClick={() => connectManual.mutate()}
            >
              Connect
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />
    </div>
  );
}

function AccountSection({
  title,
  accounts,
  canDisconnect,
  disconnectingId,
  onDisconnect,
}: {
  title: string;
  accounts: CommunicationAccount[];
  canDisconnect: boolean;
  disconnectingId: string | null | undefined;
  onDisconnect: (id: string) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {accounts.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
              <p className="truncate text-xs text-foreground-muted">
                {a.displayIdentifier || a.externalAccountId || "Meta WhatsApp"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge tone={a.isActive ? "success" : "neutral"}>
                {a.isActive ? "Connected" : "Disconnected"}
              </StatusBadge>
              {canDisconnect && a.isActive ? (
                <Button size="sm" variant="outline" disabled={disconnectingId === a.id} onClick={() => onDisconnect(a.id)}>
                  <Unplug className="size-3.5" />
                  Disconnect
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
