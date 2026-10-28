"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, PhoneOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi, type CommunicationAccount, type WhatsAppCall } from "@/lib/api/crm";
import {
  applyRemoteAnswer,
  createOfferSdp,
  createSoftphone,
  destroySoftphone,
  type SoftphoneSession,
} from "./whatsapp-webrtc";

type Context = {
  customerId?: string;
  dealId?: string;
  leadId?: string;
  defaultPhone?: string | null;
};

export function WhatsAppCallDialog({
  open,
  onOpenChange,
  context,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: Context;
  accounts: CommunicationAccount[];
}) {
  const qc = useQueryClient();
  const [accountId, setAccountId] = React.useState("");
  const [to, setTo] = React.useState(context.defaultPhone ?? "");
  const [phase, setPhase] = React.useState<"idle" | "calling" | "connected" | "error">("idle");
  const [error, setError] = React.useState("");
  const [activeCall, setActiveCall] = React.useState<WhatsAppCall | null>(null);
  const sessionRef = React.useRef<SoftphoneSession | null>(null);
  const pollRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    setTo(context.defaultPhone ?? "");
  }, [context.defaultPhone]);

  React.useEffect(() => {
    if (!accountId && accounts[0]) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const cleanup = React.useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    destroySoftphone(sessionRef.current);
    sessionRef.current = null;
  }, []);

  React.useEffect(() => () => cleanup(), [cleanup]);

  React.useEffect(() => {
    if (!open) {
      cleanup();
      setPhase("idle");
      setError("");
      setActiveCall(null);
    }
  }, [open, cleanup]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["timeline"] });
    void qc.invalidateQueries({ queryKey: ["whatsapp-calls"] });
    void qc.invalidateQueries({ queryKey: ["customer-360"] });
  };

  const permissionMutation = useMutation({
    mutationFn: () =>
      crmApi.requestWhatsAppCallPermission({
        accountId: accountId || undefined,
        to: to || undefined,
        body: "We would like to call you on WhatsApp about your enquiry.",
        customerId: context.customerId,
        dealId: context.dealId,
        leadId: context.leadId,
      }),
    onSuccess: () => {
      toast.success("Call permission request sent");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message || "Permission request failed"),
  });

  const hangUp = async () => {
    const call = activeCall;
    cleanup();
    setPhase("idle");
    if (call) {
      try {
        await crmApi.terminateWhatsAppCall(call.id);
      } catch {
        // best-effort
      }
      invalidate();
    }
    setActiveCall(null);
    onOpenChange(false);
  };

  const startCall = async () => {
    setError("");
    setPhase("calling");
    try {
      const session = await createSoftphone();
      sessionRef.current = session;
      const sdp = await createOfferSdp(session.pc);
      const call = await crmApi.initiateWhatsAppCall({
        accountId: accountId || undefined,
        to: to || undefined,
        sdp,
        sdpType: "offer",
        customerId: context.customerId,
        dealId: context.dealId,
        leadId: context.leadId,
      });
      setActiveCall(call);
      invalidate();

      pollRef.current = window.setInterval(async () => {
        try {
          const latest = await crmApi.getWhatsAppCall(call.id);
          setActiveCall(latest);
          if (latest.remoteSdp && sessionRef.current) {
            await applyRemoteAnswer(sessionRef.current.pc, latest.remoteSdp);
            if (pollRef.current !== null) {
              window.clearInterval(pollRef.current);
              pollRef.current = null;
            }
            setPhase("connected");
            toast.success("WhatsApp call connected");
          }
          if (["completed", "failed", "rejected", "missed", "canceled"].includes(latest.status)) {
            cleanup();
            setPhase("idle");
            setActiveCall(null);
            onOpenChange(false);
            invalidate();
          }
        } catch {
          // keep polling
        }
      }, 1500);
    } catch (err) {
      cleanup();
      const message = err instanceof Error ? err.message : "Call failed";
      setError(message);
      setPhase("error");
      toast.error(message);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v && (phase === "calling" || phase === "connected")) return;
        onOpenChange(v);
      }}
    >
      <ModalContent>
        <ModalHeader>
          <ModalTitle>WhatsApp call</ModalTitle>
          <ModalDescription>
            Business-initiated call via Meta Cloud API. The contact must have granted call permission first.
            Inbound user calls are free; outbound calls are billed by Meta.
          </ModalDescription>
        </ModalHeader>
        <div className="space-y-3 px-1 py-2">
          <div className="space-y-1">
            <Label>From WhatsApp account</Label>
            <Select value={accountId || "none"} onValueChange={(v) => setAccountId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Default account</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.displayIdentifier || a.externalAccountId || "Meta"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label required>To</Label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="+61…"
              disabled={phase === "calling" || phase === "connected"}
              required
              aria-required="true"
            />
          </div>
          {phase === "calling" ? (
            <p className="text-sm text-foreground-muted">Ringing on WhatsApp…</p>
          ) : null}
          {phase === "connected" ? (
            <p className="text-sm font-medium text-success">Connected — speak with your headset mic.</p>
          ) : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
        <ModalFooter className="flex-wrap gap-2">
          {phase === "idle" || phase === "error" ? (
            <>
              <Button
                variant="outline"
                disabled={permissionMutation.isPending}
                onClick={() => permissionMutation.mutate()}
              >
                <ShieldCheck className="size-3.5" />
                Request permission
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => void startCall()}>
                <Phone className="size-3.5" />
                Call on WhatsApp
              </Button>
            </>
          ) : (
            <Button variant="destructive" onClick={() => void hangUp()}>
              <PhoneOff className="size-3.5" />
              Hang up
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/** Polls for inbound ringing WhatsApp calls and lets the SE answer in-browser. */
export function IncomingWhatsAppCallBanner() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const sessionRef = React.useRef<SoftphoneSession | null>(null);
  const enabled = can("communications:send") || can("communications:view");

  const ringingQuery = useQuery({
    queryKey: ["whatsapp-calls", "ringing"],
    queryFn: () => {
      const params = new URLSearchParams({ active: "1", status: "ringing", limit: "5" });
      return crmApi.listWhatsAppCalls(params);
    },
    enabled,
    refetchInterval: 2000,
  });

  const inbound = (ringingQuery.data?.data ?? []).filter((c) => c.direction === "inbound");

  React.useEffect(() => () => destroySoftphone(sessionRef.current), []);

  const answer = async (call: WhatsAppCall) => {
    if (!call.remoteSdp) {
      toast.error("Call offer not ready yet — try again in a moment");
      return;
    }
    setBusyId(call.id);
    try {
      const { createAnswerSdp } = await import("./whatsapp-webrtc");
      const session = await createSoftphone();
      sessionRef.current = session;
      const answerSdp = await createAnswerSdp(session.pc, call.remoteSdp);
      await crmApi.preAcceptWhatsAppCall(call.id, { sdp: answerSdp, sdpType: "answer" });
      await crmApi.acceptWhatsAppCall(call.id, { sdp: answerSdp, sdpType: "answer" });
      toast.success("WhatsApp call answered");
      void qc.invalidateQueries({ queryKey: ["whatsapp-calls"] });
      void qc.invalidateQueries({ queryKey: ["timeline"] });
    } catch (err) {
      destroySoftphone(sessionRef.current);
      sessionRef.current = null;
      toast.error(err instanceof Error ? err.message : "Could not answer call");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (call: WhatsAppCall) => {
    setBusyId(call.id);
    try {
      await crmApi.rejectWhatsAppCall(call.id);
      void qc.invalidateQueries({ queryKey: ["whatsapp-calls"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  };

  const hangUp = async (call: WhatsAppCall) => {
    destroySoftphone(sessionRef.current);
    sessionRef.current = null;
    try {
      await crmApi.terminateWhatsAppCall(call.id);
    } catch {
      // ignore
    }
    void qc.invalidateQueries({ queryKey: ["whatsapp-calls"] });
  };

  if (!enabled) return null;
  if (inbound.length === 0 && !sessionRef.current) return null;
  const call = inbound[0];

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-line bg-surface px-4 py-3 shadow-lg">
      {call ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Incoming WhatsApp call</p>
            <p className="text-xs text-foreground-muted">{call.fromNumber || "Unknown number"}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={busyId === call.id} onClick={() => void reject(call)}>
              Decline
            </Button>
            <Button size="sm" disabled={busyId === call.id} onClick={() => void answer(call)}>
              <Phone className="size-3.5" />
              Answer
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">WhatsApp call in progress</p>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              const id = sessionRef.current ? ringingQuery.data?.data?.[0]?.id : null;
              if (id) void hangUp({ id } as WhatsAppCall);
              else {
                destroySoftphone(sessionRef.current);
                sessionRef.current = null;
              }
            }}
          >
            <PhoneOff className="size-3.5" />
            Hang up
          </Button>
        </div>
      )}
    </div>
  );
}
