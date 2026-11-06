"use client";

import * as React from "react";

const HOUR_MS = 3_600_000;

/** Wall-clock ms that advances once per hour so stage-age labels refresh without a refetch. */
export function useHourlyNow(): number {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    let cancelled = false;
    let intervalId = 0;
    const tick = () => {
      if (!cancelled) setNow(Date.now());
    };
    const delay = HOUR_MS - (Date.now() % HOUR_MS);
    const timeoutId = window.setTimeout(() => {
      tick();
      intervalId = window.setInterval(tick, HOUR_MS);
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  return now;
}
