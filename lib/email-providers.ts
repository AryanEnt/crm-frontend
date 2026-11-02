export type ImapProviderKind = "migadu" | "spacemail" | "imap";

export type ImapSmtpPreset = {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
};

export const IMAP_PROVIDER_OPTIONS: { value: ImapProviderKind; label: string }[] = [
  { value: "migadu", label: "Migadu" },
  { value: "spacemail", label: "Spacemail" },
  { value: "imap", label: "Custom IMAP/SMTP" },
];

export const IMAP_PRESETS: Record<Exclude<ImapProviderKind, "imap">, ImapSmtpPreset> = {
  migadu: {
    imapHost: "imap.migadu.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.migadu.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  spacemail: {
    imapHost: "mail.spacemail.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "mail.spacemail.com",
    smtpPort: 465,
    smtpSecure: true,
  },
};

export function presetFor(provider: ImapProviderKind): ImapSmtpPreset {
  if (provider === "imap") {
    return {
      imapHost: "",
      imapPort: 993,
      imapSecure: true,
      smtpHost: "",
      smtpPort: 465,
      smtpSecure: true,
    };
  }
  return IMAP_PRESETS[provider];
}

/** Lowercased domain of a complete-looking address, or "" while the user is still typing. */
export function emailDomain(value: string): string {
  const at = value.trim().lastIndexOf("@");
  if (at <= 0) return "";
  const domain = value.trim().slice(at + 1).toLowerCase().replace(/\.$/, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) && !/\.$|-\.|\.-/.test(domain) ? domain : "";
}

export function providerLabel(p?: string) {
  if (p === "migadu") return "Migadu";
  if (p === "spacemail") return "Spacemail";
  if (p === "imap") return "IMAP";
  if (p === "gmail") return "Gmail";
  return "Not connected";
}
