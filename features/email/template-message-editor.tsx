"use client";

import * as React from "react";
import { Bold, Eye, Italic, List, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export const LEAD_FIELDS = [
  { token: "{{first_name}}", label: "First name", example: "Asha" },
  { token: "{{last_name}}", label: "Last name", example: "Sharma" },
  { token: "{{company_name}}", label: "Company", example: "Bright Path Consulting" },
  { token: "{{lead_owner}}", label: "Your name", example: "Jordan Lee" },
  { token: "{{phone}}", label: "Phone", example: "+61 400 000 000" },
  { token: "{{email}}", label: "Email", example: "asha@brightpath.example" },
] as const;

const PREVIEW_VARS: Record<string, string> = Object.fromEntries(
  LEAD_FIELDS.map((f) => [f.token.replace(/[{}]/g, ""), f.example]),
);

export const TEMPLATE_VAR_KEYS = LEAD_FIELDS.map((f) => f.token.replace(/[{}]/g, ""));

export function fillLeadVars(s: string) {
  return s.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => PREVIEW_VARS[key] || match);
}

export function textToHtml(text: string) {
  const trimmed = text.trim();
  if (trimmed === "") return "";
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .split("\n")
    .map((line) => (line === "" ? "<div><br></div>" : `<div>${escapeHtml(line)}</div>`))
    .join("");
}

export function htmlToPlain(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>\s*<div>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

export function TemplateMessageEditor({
  subject,
  onSubjectChange,
  bodyHtml,
  onBodyChange,
}: {
  subject: string;
  onSubjectChange: (value: string) => void;
  bodyHtml: string;
  onBodyChange: (html: string) => void;
}) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const [mode, setMode] = React.useState<"write" | "preview">("write");
  const initialHtml = React.useRef(bodyHtml);

  React.useEffect(() => {
    const el = editorRef.current;
    if (el) el.innerHTML = initialHtml.current;
  }, []);

  const insertField = (token: string) => {
    setMode("write");
    requestAnimationFrame(() => {
      editorRef.current?.focus();
      exec("insertText", token);
      onBodyChange(editorRef.current?.innerHTML ?? "");
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <span className="w-16 shrink-0 text-xs text-foreground-subtle">To</span>
        <span className="text-sm text-foreground-muted">Client — filled in when sending</span>
      </div>
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <label htmlFor="tpl-subject" className="w-16 shrink-0 text-xs text-foreground-subtle">
          Subject
        </label>
        <input
          id="tpl-subject"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="Following up on our conversation"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground-subtle"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-surface-muted/50 px-2 py-1.5">
        <ToolbarBtn label="Bold" onClick={() => exec("bold")}>
          <Bold className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn label="Italic" onClick={() => exec("italic")}>
          <Italic className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn label="List" onClick={() => exec("insertUnorderedList")}>
          <List className="size-3.5" />
        </ToolbarBtn>
        <span className="mx-1 h-4 w-px bg-border" />
        {LEAD_FIELDS.map((f) => (
          <button
            key={f.token}
            type="button"
            title={`Insert ${f.label}`}
            className="rounded-md px-2 py-1 text-xs text-foreground-muted hover:bg-surface hover:text-foreground"
            onClick={() => insertField(f.token)}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          className={cn(
            "ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs",
            mode === "preview"
              ? "bg-surface text-foreground shadow-sm"
              : "text-foreground-muted hover:bg-surface hover:text-foreground",
          )}
          onClick={() => setMode((m) => (m === "write" ? "preview" : "write"))}
        >
          {mode === "preview" ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}
          {mode === "preview" ? "Edit" : "Preview"}
        </button>
      </div>

      <div
        className={cn("min-h-[280px] flex-1 overflow-y-auto px-5 py-4", mode === "write" ? "block" : "hidden")}
      >
        <div
          ref={editorRef}
          role="textbox"
          aria-label="Email message"
          contentEditable
          data-placeholder="Write the email your team will send…"
          className={cn(
            "min-h-[240px] text-sm leading-7 outline-none",
            "[&:empty]:before:pointer-events-none [&:empty]:before:text-foreground-subtle [&:empty]:before:content-[attr(data-placeholder)]",
          )}
          onInput={() => onBodyChange(editorRef.current?.innerHTML ?? "")}
        />
      </div>
      <div
        className={cn("min-h-[280px] flex-1 overflow-y-auto px-5 py-4", mode === "preview" ? "block" : "hidden")}
      >
        <p className="text-sm font-medium text-foreground">{fillLeadVars(subject) || "No subject"}</p>
        <div
          className="mt-3 text-sm leading-relaxed text-foreground"
          dangerouslySetInnerHTML={{
            __html: fillLeadVars(bodyHtml) || "<p class='text-foreground-muted'>Nothing to preview yet.</p>",
          }}
        />
        <p className="mt-6 text-[11px] text-foreground-subtle">
          Sample lead: Asha Sharma, Bright Path Consulting
        </p>
      </div>
    </div>
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
      className="rounded p-1.5 text-foreground-muted hover:bg-surface hover:text-foreground"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
