"use client";

import * as React from "react";

/** `serverValue` is used for SSR and hydration, then the real match takes over. */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = React.useCallback(
    (notify: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    [query],
  );
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
