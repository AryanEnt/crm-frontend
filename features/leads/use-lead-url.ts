"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** `?leadId=` drives the shared lead panel on both /leads and /pipeline, so links and refreshes reopen it. */
export function useLeadUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const patchQuery = React.useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value) params.delete(key);
        else params.set(key, value);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const openLead = React.useCallback((id: string) => patchQuery({ leadId: id }), [patchQuery]);
  const closeLead = React.useCallback(() => patchQuery({ leadId: null }), [patchQuery]);

  return { searchParams, patchQuery, leadId: searchParams.get("leadId"), openLead, closeLead };
}
