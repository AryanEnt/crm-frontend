"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Phone, CalendarPlus } from "lucide-react";
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
import { crmApi } from "@/lib/api/crm";
import { ActivityQuickCreateDialog } from "@/features/activities/activity-quick-create";

type Context = {
  customerId?: string;
  dealId?: string;
  leadId?: string;
  defaultPhone?: string | null;
};

export function CommunicationActions({ context }: { context: Context }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [whatsAppOpen, setWhatsAppOpen] = React.useState(false);
  const [callOpen, setCallOpen] = React.useState(false);
  const [activityOpen, setActivityOpen] = React.useState(false);
  const [waAccountId, setWaAccountId] = React.useState("");
  const [callAccountId, setCallAccountId] = React.useState("");
  const [to, setTo] = React.useState(context.defaultPhone ?? "");
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setTo(context.defaultPhone ?? "");
  }, [context.defaultPhone]);

  const accountsQuery = useQuery({
    queryKey: ["communication-accounts"],
    queryFn: () => crmApi.listCommunicationAccounts(),
    enabled: can("communications:view") || can("communications:send"),
  });

  const waAccounts = (accountsQuery.data ?? []).filter((a) => a.provider === "meta_whatsapp");
  const twilioAccounts = (accountsQuery.data ?? []).filter((a) => a.provider === "twilio_voice");

  React.useEffect(() => {
    if (!waAccountId && waAccounts[0]) setWaAccountId(waAccounts[0].id);
  }, [waAccounts, waAccountId]);
  React.useEffect(() => {
    if (!callAccountId && twilioAccounts[0]) setCallAccountId(twilioAccounts[0].id);
  }, [twilioAccounts, callAccountId]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["timeline"] });
    void qc.invalidateQueries({ queryKey: ["whatsapp-messages"] });
    void qc.invalidateQueries({ queryKey: ["twilio-calls"] });
    void qc.invalidateQueries({ queryKey: ["customer-360"] });
    void qc.invalidateQueries({ queryKey: ["deal"] });
  };

  const sendMutation = useMutation({
    mutationFn: () =>
      crmApi.sendWhatsApp({
        accountId: waAccountId || undefined,
        to: to || undefined,
        body,
        customerId: context.customerId,
        dealId: context.dealId,
        leadId: context.leadId,
      }),
    onSuccess: () => {
      setWhatsAppOpen(false);
      setBody("");
      setError("");
      invalidate();
      toast.success("WhatsApp message sent");
    },
    onError: (err: Error) => {
      const message = err.message || "Send failed";
      setError(message);
      toast.error(message);
    },
  });

  const callMutation = useMutation({
    mutationFn: () =>
      crmApi.placeTwilioCall({
        accountId: callAccountId || undefined,
        to: to || undefined,
        customerId: context.customerId,
        dealId: context.dealId,
        leadId: context.leadId,
      }),
    onSuccess: () => {
      setCallOpen(false);
      setError("");
      invalidate();
      toast.success("Call started");
    },
    onError: (err: Error) => {
      const message = err.message || "Call failed";
      setError(message);
      toast.error(message);
    },
  });

  if (!can("activities:create") && !can("communications:send")) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {can("communications:send") ? (
          <>
            <Button size="sm" variant="outline" onClick={() => { setError(""); setWhatsAppOpen(true); }}>
              <MessageCircle className="size-3.5" />
              WhatsApp
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setError(""); setCallOpen(true); }}>
              <Phone className="size-3.5" />
              Call
            </Button>
          </>
        ) : null}
        {can("activities:create") ? (
          <Button size="sm" variant="outline" onClick={() => setActivityOpen(true)}>
            <CalendarPlus className="size-3.5" />
            Create activity
          </Button>
        ) : null}
      </div>

      <Modal open={whatsAppOpen} onOpenChange={setWhatsAppOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Send WhatsApp</ModalTitle>
            <ModalDescription>
              Via Meta WhatsApp Cloud API — not Twilio. Message appears on the unified timeline.
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-3 px-1 py-2">
            <div className="space-y-1">
              <Label>From number / account</Label>
              <Select value={waAccountId || "none"} onValueChange={(v) => setWaAccountId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default account</SelectItem>
                  {waAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.displayIdentifier || a.externalAccountId || "Meta"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label required>To</Label>
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="+61…" required aria-required="true" />
            </div>
            <div className="space-y-1">
              <Label required>Message</Label>
              <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type your message…" required aria-required="true" />
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setWhatsAppOpen(false)}>Cancel</Button>
            <Button
              disabled={!body.trim() || sendMutation.isPending}
              onClick={() => sendMutation.mutate()}
            >
              Send
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal open={callOpen} onOpenChange={setCallOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Place call</ModalTitle>
            <ModalDescription>
              Via Twilio Voice. Call status updates write to the same CRM timeline.
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-3 px-1 py-2">
            <div className="space-y-1">
              <Label>From number / account</Label>
              <Select value={callAccountId || "none"} onValueChange={(v) => setCallAccountId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default account</SelectItem>
                  {twilioAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.displayIdentifier || "Twilio"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label required>To</Label>
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="+61…" required aria-required="true" />
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setCallOpen(false)}>Cancel</Button>
            <Button disabled={callMutation.isPending} onClick={() => callMutation.mutate()}>
              Call now
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ActivityQuickCreateDialog
        open={activityOpen}
        onOpenChange={setActivityOpen}
        context={{
          customerId: context.customerId,
          dealId: context.dealId,
          leadId: context.leadId,
        }}
        onCreated={invalidate}
      />
    </>
  );
}
