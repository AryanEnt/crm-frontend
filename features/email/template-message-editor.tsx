"use client";

import * as React from "react";
import { Bold, Eye, ImagePlus, Italic, List, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_SIGNATURE_IMAGE_BYTES = 400 * 1024;
const SIGNATURE_IMAGE_ACCEPT = "image/png,image/jpeg,image/jpg,image/gif,image/webp";

/** Inline styles travel with the email so clients render the signature consistently. */
const SIGNATURE_IMG_STYLE =
  "max-width:160px;max-height:64px;width:auto;height:auto;display:block;margin:10px 0 0;border:0;outline:none;";

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

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Couldn't read that image"));
    };
    reader.onerror = () => reject(new Error("Couldn't read that image"));
    reader.readAsDataURL(file);
  });
}

/** Wrap signature HTML the way it should appear under a professional email. */
export function formatSignatureBlock(signatureHtml: string) {
  const sig = (signatureHtml ?? "").trim();
  if (!sig) return "";
  return `<div class="crm-email-signature" style="margin-top:20px;padding-top:14px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;color:#374151;">${sig}</div>`;
}

/** Join message body and signature the same way Compose and automations do. */
export function joinTemplateBody(bodyHtml: string, signatureHtml?: string | null) {
  const body = (bodyHtml ?? "").trim();
  const sigBlock = formatSignatureBlock(signatureHtml ?? "");
  if (!sigBlock) return body;
  if (!body) return sigBlock;
  return `${body}${sigBlock}`;
}

const signatureEditorClass = cn(
  "min-h-[56px] max-h-28 overflow-y-auto text-[13px] leading-[1.45] text-[#374151] outline-none",
  "font-[Arial,Helvetica,sans-serif]",
  "[&_div]:min-h-[1.45em]",
  "[&_img]:mt-2.5 [&_img]:block [&_img]:max-h-16 [&_img]:max-w-40 [&_img]:object-contain",
  "[&:empty]:before:pointer-events-none [&:empty]:before:text-[#9ca3af] [&:empty]:before:content-[attr(data-placeholder)]",
);

export function TemplateMessageEditor({
  subject,
  onSubjectChange,
  bodyHtml,
  onBodyChange,
  signatureHtml,
  onSignatureChange,
}: {
  subject: string;
  onSubjectChange: (value: string) => void;
  bodyHtml: string;
  onBodyChange: (html: string) => void;
  signatureHtml: string;
  onSignatureChange: (html: string) => void;
}) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const signatureRef = React.useRef<HTMLDivElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const [mode, setMode] = React.useState<"write" | "preview">("write");
  const [focusTarget, setFocusTarget] = React.useState<"body" | "signature">("body");
  const [addingImage, setAddingImage] = React.useState(false);
  const initialBody = React.useRef(bodyHtml);
  const initialSignature = React.useRef(signatureHtml);

  React.useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = initialBody.current;
    if (signatureRef.current) signatureRef.current.innerHTML = initialSignature.current;
  }, []);

  const syncSignature = () => onSignatureChange(signatureRef.current?.innerHTML ?? "");

  const insertField = (token: string) => {
    setMode("write");
    requestAnimationFrame(() => {
      const el = focusTarget === "signature" ? signatureRef.current : editorRef.current;
      el?.focus();
      exec("insertText", token);
      if (focusTarget === "signature") syncSignature();
      else onBodyChange(editorRef.current?.innerHTML ?? "");
    });
  };

  const insertSignatureImage = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose a PNG, JPG, GIF, or WebP image");
      return;
    }
    if (file.size > MAX_SIGNATURE_IMAGE_BYTES) {
      toast.error("Keep signature images under 400 KB");
      return;
    }
    setAddingImage(true);
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setMode("write");
      setFocusTarget("signature");
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const el = signatureRef.current;
      if (!el) return;
      el.focus();
      const safeName = escapeHtml(file.name.replace(/\.[^.]+$/, "") || "Logo");
      const html = `<div><img src="${dataUrl}" alt="${safeName}" style="${SIGNATURE_IMG_STYLE}" /></div>`;
      const ok = document.execCommand("insertHTML", false, html);
      if (!ok) el.insertAdjacentHTML("beforeend", html);
      syncSignature();
      toast.success("Image added to signature");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add that image");
    } finally {
      setAddingImage(false);
    }
  };

  const previewHtml = joinTemplateBody(fillLeadVars(bodyHtml), fillLeadVars(signatureHtml));

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

      {/* One scroll area so the signature never overlays the message on short screens. */}
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain",
          mode === "write" ? "block" : "hidden",
        )}
      >
        <div className="px-4 pb-2 pt-3 sm:px-5 sm:pt-4">
          <div
            ref={editorRef}
            role="textbox"
            aria-label="Email message"
            contentEditable
            data-placeholder="Write the email your team will send…"
            className={cn(
              "min-h-[120px] text-sm leading-7 text-foreground outline-none sm:min-h-[160px]",
              "[&:empty]:before:pointer-events-none [&:empty]:before:text-foreground-subtle [&:empty]:before:content-[attr(data-placeholder)]",
            )}
            onFocus={() => setFocusTarget("body")}
            onInput={() => onBodyChange(editorRef.current?.innerHTML ?? "")}
          />
        </div>

        <div className="border-t border-[#e5e7eb] bg-[#fafafa] px-4 py-3 sm:px-5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#9ca3af]">
              Signature
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 shrink-0 text-xs text-foreground-muted"
              disabled={addingImage}
              onClick={() => {
                setFocusTarget("signature");
                imageInputRef.current?.click();
              }}
            >
              <ImagePlus className="size-3.5" />
              {addingImage ? "Adding…" : "Add logo"}
            </Button>
            <input
              ref={imageInputRef}
              type="file"
              accept={SIGNATURE_IMAGE_ACCEPT}
              className="hidden"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.currentTarget.value = "";
                void insertSignatureImage(file);
              }}
            />
          </div>
          <div
            ref={signatureRef}
            role="textbox"
            aria-label="Email signature"
            contentEditable
            data-placeholder="Best regards, {{lead_owner}}"
            className={signatureEditorClass}
            onFocus={() => {
              setFocusTarget("signature");
              // Keep the signature visible above the keyboard / modal footer on small screens.
              requestAnimationFrame(() => {
                signatureRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
              });
            }}
            onInput={syncSignature}
            onPaste={(e) => {
              const file = [...(e.clipboardData?.items ?? [])]
                .find((item) => item.type.startsWith("image/"))
                ?.getAsFile();
              if (!file) return;
              e.preventDefault();
              void insertSignatureImage(file);
            }}
          />
        </div>
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4",
          mode === "preview" ? "block" : "hidden",
        )}
      >
        <p className="text-sm font-medium text-foreground">{fillLeadVars(subject) || "No subject"}</p>
        <div
          className="mt-3 text-sm leading-relaxed text-foreground [&_.crm-email-signature]:mt-5"
          dangerouslySetInnerHTML={{
            __html: previewHtml || "<p class='text-foreground-muted'>Nothing to preview yet.</p>",
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
