"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import type { MailboxCheck, MailboxStageResult } from "@/lib/api/email";
import { cn } from "@/lib/utils";

function StageRow({ label, result }: { label: string; result: MailboxStageResult }) {
  const Icon = result.ok ? CheckCircle2 : XCircle;
  return (
    <li className="flex items-start gap-2">
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", result.ok ? "text-success" : "text-danger")}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-caption font-medium text-ink">
          {label} <span className="font-normal text-ink-muted">{result.ok ? "connected" : "failed"}</span>
        </p>
        <p className="text-caption text-ink-muted">
          {result.host}:{result.port} · {result.secure ? "SSL/TLS" : "STARTTLS"}
        </p>
        {!result.ok && result.message ? <p className="mt-0.5 text-caption text-danger">{result.message}</p> : null}
      </div>
    </li>
  );
}

/** Separate IMAP (receive) and SMTP (send) outcomes, plus the reference support can search logs for. */
export function MailboxCheckResults({ check, className }: { check: MailboxCheck; className?: string }) {
  const failed = !check.imap.ok || !check.smtp.ok;
  return (
    <div
      role={failed ? "alert" : "status"}
      className={cn(
        "space-y-2 rounded-xl border p-3",
        failed ? "border-danger/30 bg-danger/5" : "border-success/30 bg-success/5",
        className,
      )}
    >
      <ul className="space-y-2">
        <StageRow label="IMAP (receive)" result={check.imap} />
        <StageRow label="SMTP (send)" result={check.smtp} />
      </ul>
      {failed && check.requestId ? (
        <p className="text-[11px] text-ink-muted">
          Reference: <span className="select-all font-mono">{check.requestId}</span>
        </p>
      ) : null}
    </div>
  );
}
