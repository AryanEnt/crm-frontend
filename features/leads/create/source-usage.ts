export type SourceOption = { name: string; usageCount?: number; position?: number };

/** What this browser remembers about the user's sources. */
export type SourceUsage = { last?: string; counts: Record<string, number> };

const EMPTY: SourceUsage = { counts: {} };
const storageKey = (userId: string) => `crm:lead-source-usage:v1:${userId}`;

/** The user's own picks first, then org-wide usage, then the admin's order. */
export function rankSources(sources: SourceOption[], usage: SourceUsage): string[] {
  return [...sources]
    .sort(
      (a, b) =>
        (usage.counts[b.name] ?? 0) - (usage.counts[a.name] ?? 0) ||
        (b.usageCount ?? 0) - (a.usageCount ?? 0) ||
        (a.position ?? 0) - (b.position ?? 0),
    )
    .map((s) => s.name);
}

export function recordSourceUse(usage: SourceUsage, name: string): SourceUsage {
  if (!name) return usage;
  return { last: name, counts: { ...usage.counts, [name]: (usage.counts[name] ?? 0) + 1 } };
}

/** Last used, else the org default, else "Other", else the top-ranked source. */
export function pickDefaultSource(ranked: string[], usage: SourceUsage, orgDefault?: string): string {
  const has = (n?: string) => !!n && ranked.includes(n);
  if (has(usage.last)) return usage.last!;
  if (has(orgDefault?.trim())) return orgDefault!.trim();
  const other = ranked.find((n) => n.toLowerCase() === "other");
  return other ?? ranked[0] ?? "";
}

export function loadSourceUsage(userId: string | undefined): SourceUsage {
  if (!userId) return EMPTY;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<SourceUsage>;
    const counts: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed.counts ?? {})) if (typeof v === "number" && v > 0) counts[k] = v;
    return { last: typeof parsed.last === "string" ? parsed.last : undefined, counts };
  } catch {
    return EMPTY;
  }
}

export function saveSourceUsage(userId: string | undefined, usage: SourceUsage): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(usage));
  } catch {
    // Private mode or a full quota: the default source just won't be remembered.
  }
}
