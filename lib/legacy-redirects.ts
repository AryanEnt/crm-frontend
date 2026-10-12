/**
 * Customers and Deals are no longer part of the product UI; Leads carry the whole
 * sales lifecycle. Old customer and deal bookmarks land on Leads; the old deal pipeline
 * lands on the lead Pipeline. The backend customer and deal routes stay available for
 * historical data.
 */
export const LEGACY_SALES_REDIRECTS = [
  { source: "/customers", destination: "/leads", permanent: false },
  { source: "/customers/:id", destination: "/leads", permanent: false },
  { source: "/deals", destination: "/leads", permanent: false },
  { source: "/deals/:id", destination: "/leads", permanent: false },
  { source: "/pipelines", destination: "/pipeline", permanent: false },
] as const;

/** Where a path would be redirected, matching Next's `:param` segments; null if not redirected. */
export function legacyRedirectFor(pathname: string): string | null {
  const parts = pathname.replace(/\/+$/, "").split("/");
  for (const r of LEGACY_SALES_REDIRECTS) {
    const pattern = r.source.split("/");
    if (pattern.length !== parts.length) continue;
    if (pattern.every((seg, i) => seg.startsWith(":") ? parts[i] !== "" : seg === parts[i])) {
      return r.destination;
    }
  }
  return null;
}
