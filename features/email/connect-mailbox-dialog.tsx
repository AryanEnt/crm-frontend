"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/console/dialog";
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
  IMAP_PROVIDER_OPTIONS,
  emailDomain,
  presetFor,
  providerLabel,
  type ImapProviderKind,
  type ImapSmtpPreset,
} from "@/lib/email-providers";
import {
  emailApi,
  mailboxCheckOf,
  type EmailIntegrationHealth,
  type ImapConnectBody,
  type MailboxCheck,
  type TeamMailboxPerson,
} from "@/lib/api/email";
import { ApiError } from "@/types/api";
import { cn } from "@/lib/utils";
import { MailboxCheckResults } from "./mailbox-check-results";

/**
 * "auto" lets the server pick from the admin's domain mapping. "company" is the org's own server
 * from MAIL_IMAP_* / MAIL_SMTP_*; it is stored as provider "imap". The rest are TL overrides.
 */
type ServerChoice = "auto" | ImapProviderKind | "company";
type CompanyServer = NonNullable<EmailIntegrationHealth["companyServer"]>;

function presetOf(choice: Exclude<ServerChoice, "auto">, company: CompanyServer | null): ImapSmtpPreset {
  if (choice === "company") return company ?? presetFor("imap");
  return presetFor(choice);
}

function detectedName(provider: ImapProviderKind): string {
  if (provider === "imap") return "the company mail server";
  return providerLabel(provider);
}

function initialChoice(saved: string | undefined, savedHost: string | undefined, company: CompanyServer | null): ServerChoice {
  if (saved === "migadu" || saved === "spacemail") return saved;
  if (saved === "imap") return company && (!savedHost || savedHost === company.imapHost) ? "company" : "imap";
  return "auto";
}

export function ConnectMailboxDialog({
  open,
  onOpenChange,
  people,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: TeamMailboxPerson[];
  initial?: TeamMailboxPerson | null;
  onSaved: () => void;
}) {
  const existing = initial?.mailbox;
  const selected = people.find((p) => p.userId === (initial?.userId ?? "")) ?? initial ?? null;
  const healthQuery = useQuery({ queryKey: ["email-health"], queryFn: emailApi.health, enabled: open, staleTime: 5 * 60_000 });
  const company = healthQuery.data?.companyServer ?? null;
  const [ownerUserId, setOwnerUserId] = React.useState(initial?.userId ?? "");
  const [provider, setProvider] = React.useState<ServerChoice>("auto");
  const [emailAddress, setEmailAddress] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [usernameTouched, setUsernameTouched] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [imapHost, setImapHost] = React.useState(presetFor("migadu").imapHost);
  const [imapPort, setImapPort] = React.useState("993");
  const [imapSecure, setImapSecure] = React.useState(true);
  const [smtpHost, setSmtpHost] = React.useState(presetFor("migadu").smtpHost);
  const [smtpPort, setSmtpPort] = React.useState("465");
  const [smtpSecure, setSmtpSecure] = React.useState(true);
  const [advanced, setAdvanced] = React.useState(false);
  const [check, setCheck] = React.useState<MailboxCheck | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [debouncedEmail, setDebouncedEmail] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedEmail(emailAddress), 350);
    return () => clearTimeout(t);
  }, [emailAddress]);
  const domain = emailDomain(debouncedEmail);
  const resolveQuery = useQuery({
    queryKey: ["email-domain-provider", domain],
    queryFn: () => emailApi.resolveDomainProvider(`mailbox@${domain}`),
    enabled: open && domain !== "",
    staleTime: 60_000,
  });
  const detected = domain && resolveQuery.data?.domain === domain ? resolveQuery.data.mapping : null;
  const detecting = domain !== "" && resolveQuery.isFetching;

  // Reset the form once per open, after health has loaded (it decides the Company server choice).
  const ready = open && !(healthQuery.isPending && !healthQuery.isError);
  const [resetFor, setResetFor] = React.useState<TeamMailboxPerson | null | false>(false);
  const target = ready ? (initial ?? null) : false;
  if (target !== resetFor) {
    setResetFor(target);
    if (target !== false) {
      const m = target?.mailbox;
      const nextProvider = initialChoice(m?.provider, m?.imapHost, company);
      const preset = presetOf(nextProvider === "auto" ? "imap" : nextProvider, company);
      const email = m?.emailAddress || target?.email || "";
      setOwnerUserId(target?.userId ?? "");
      setProvider(nextProvider);
      setEmailAddress(email);
      setDebouncedEmail(email);
      setUsername(m?.username || "");
      setUsernameTouched(Boolean(m?.username && m.username !== email));
      setPassword("");
      setShowPassword(false);
      setImapHost(m?.imapHost || preset.imapHost);
      setImapPort(String(m?.imapPort || preset.imapPort));
      setImapSecure(m?.imapSecure !== false);
      setSmtpHost(m?.smtpHost || preset.smtpHost);
      setSmtpPort(String(m?.smtpPort || preset.smtpPort));
      setSmtpSecure(m?.smtpSecure !== false);
      setAdvanced(nextProvider === "imap");
      setCheck(null);
      setError(null);
    }
  }

  const applyProvider = (next: ServerChoice) => {
    setProvider(next);
    setCheck(null);
    if (next === "auto") return;
    const preset = presetOf(next, company);
    if (next !== "imap") {
      setImapHost(preset.imapHost);
      setImapPort(String(preset.imapPort));
      setImapSecure(preset.imapSecure);
      setSmtpHost(preset.smtpHost);
      setSmtpPort(String(preset.smtpPort));
      setSmtpSecure(preset.smtpSecure);
    } else {
      setAdvanced(true);
    }
  };

  const onEmailChange = (value: string) => {
    setEmailAddress(value);
    if (!usernameTouched) setUsername("");
  };

  const body = (): ImapConnectBody => {
    const base = {
      ownerUserId,
      emailAddress: emailAddress.trim(),
      username: (username.trim() || emailAddress.trim()) || undefined,
      password,
    };
    if (provider === "auto") return { ...base, provider: "auto" };
    return {
      ...base,
      provider: provider === "company" ? "imap" : provider,
      imapHost: imapHost.trim(),
      imapPort: Number(imapPort) || undefined,
      imapSecure,
      smtpHost: smtpHost.trim(),
      smtpPort: Number(smtpPort) || undefined,
      smtpSecure,
    };
  };

  const failure = (err: Error, fallback: string) => {
    const result = err instanceof ApiError ? mailboxCheckOf(err) : null;
    setCheck(result);
    // Per-protocol messages are shown in the results panel; only non-mail errors need the line below.
    setError(result ? null : err instanceof ApiError ? err.message : fallback);
  };

  const test = useMutation({
    mutationFn: () => emailApi.testTeamMailbox(body()),
    onSuccess: (data) => {
      setError(null);
      setCheck(mailboxCheckOf(data));
    },
    onError: (err: Error) => failure(err, "Could not reach the mailbox. Check the email and password."),
  });

  const save = useMutation({
    mutationFn: () => emailApi.connectTeamMailbox(body()),
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
    },
    onError: (err: Error) => failure(err, "Could not save the mailbox"),
  });

  const serverOptions: { value: ServerChoice; label: string }[] = [
    { value: "auto", label: "Detect automatically" },
    ...(company ? [{ value: "company" as const, label: "Company server" }] : []),
    ...IMAP_PROVIDER_OPTIONS,
  ];

  const autoBlocked = provider === "auto" && (!detected || domain !== emailDomain(emailAddress));
  const canSubmit = Boolean(
    ownerUserId && emailAddress.includes("@") && password && (provider === "auto" ? !autoBlocked : imapHost && smtpHost),
  );
  const summary =
    provider === "auto"
      ? detected
        ? `${detectedName(detected.provider)} (detected)`
        : "Detect automatically"
      : `${serverOptions.find((o) => o.value === provider)?.label}${
          provider === "company" || provider === "imap" ? ` (${imapHost || "no host"})` : ""
        } · chosen by you`;
  const personName = people.find((p) => p.userId === ownerUserId)?.fullName ?? selected?.fullName;
  const lockedPerson = Boolean(initial?.userId);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={existing ? "Update mailbox" : "Connect mailbox"}
      description={
        personName
          ? `${personName} will send from this address. They never see the password.`
          : "They will send from this address. They never see the password."
      }
      dismissible={!save.isPending}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="button" variant="outline" disabled={!canSubmit || test.isPending} onClick={() => test.mutate()}>
            {test.isPending ? "Testing…" : "Test"}
          </Button>
          <Button type="button" disabled={!canSubmit || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Connecting…" : existing ? "Save" : "Connect"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {lockedPerson ? null : (
          <Field label="Who is this for?">
            <Select value={ownerUserId} onValueChange={setOwnerUserId}>
              <SelectTrigger aria-label="Sales executive" className="h-10">
                <SelectValue placeholder="Choose a person" />
              </SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.userId} value={p.userId}>
                    {p.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field label="Email" required>
          <Input
            type="email"
            className="h-10"
            value={emailAddress}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="name@company.com"
            autoComplete="off"
            autoFocus
          />
        </Field>

        <Field label="Password" required>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              className="h-10 pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Mailbox password"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-muted hover:text-ink"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
        </Field>

        <div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-caption font-medium text-ink-muted hover:text-ink"
            aria-expanded={advanced}
            onClick={() => setAdvanced((v) => !v)}
          >
            <ChevronDown className={cn("size-3.5 transition-transform", advanced && "rotate-180")} aria-hidden />
            Server settings
            <span className="font-normal text-ink-muted">· {summary}</span>
          </button>
          {provider === "auto" ? (
            <p className={cn("mt-1.5 text-caption", detected || !domain ? "text-ink-muted" : "text-warning")}>
              {!domain
                ? "The mail server is chosen from the email address."
                : detecting
                  ? `Looking up @${domain}…`
                  : detected
                    ? `Detected ${detectedName(detected.provider)} for @${domain}: IMAP ${detected.settings.imapHost}:${detected.settings.imapPort}, SMTP ${detected.settings.smtpHost}:${detected.settings.smtpPort}.`
                    : `Couldn't detect a mail server for @${domain}. Choose one below.`}
            </p>
          ) : null}

          {advanced ? (
            <div className="mt-3 space-y-3 rounded-xl border border-line bg-surface-muted/40 p-3">
              <div className="flex flex-wrap gap-1.5">
                {serverOptions.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => applyProvider(o.value)}
                    className={cn(
                      "h-7 rounded-full px-2.5 text-caption font-medium",
                      provider === o.value
                        ? "bg-brand text-primary-foreground"
                        : "bg-surface text-ink-secondary ring-1 ring-line hover:text-ink",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <Field label="Username">
                <Input
                  value={username}
                  onChange={(e) => {
                    setUsernameTouched(true);
                    setUsername(e.target.value);
                  }}
                  placeholder={emailAddress.trim() || "Same as email"}
                  autoComplete="off"
                />
              </Field>
              {provider === "auto" ? null : (
              <>
              <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                <Field label="IMAP host">
                  <Input value={imapHost} onChange={(e) => setImapHost(e.target.value)} />
                </Field>
                <Field label="Port">
                  <Input value={imapPort} onChange={(e) => setImapPort(e.target.value)} inputMode="numeric" />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-caption text-ink-secondary">
                <input type="checkbox" checked={imapSecure} onChange={(e) => setImapSecure(e.target.checked)} />
                IMAP SSL/TLS
              </label>
              <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                <Field label="SMTP host">
                  <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
                </Field>
                <Field label="Port">
                  <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} inputMode="numeric" />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-caption text-ink-secondary">
                <input type="checkbox" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} />
                SMTP SSL/TLS
              </label>
              </>
              )}
            </div>
          ) : null}
        </div>

        <div aria-live="polite" className="space-y-2">
          {check ? <MailboxCheckResults check={check} /> : null}
          {error ? <p className="text-caption text-danger">{error}</p> : null}
        </div>
      </div>
    </Dialog>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label required={required}>{label}</Label>
      {children}
    </div>
  );
}
