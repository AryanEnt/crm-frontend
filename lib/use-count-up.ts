"use client";

import * as React from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Animates a number from its last displayed value to `target` (ease-out cubic).
 * Reduced motion jumps straight to the target on the next frame.
 * Callers format the returned value; it is fractional mid-animation.
 */
export function useCountUp(target: number, duration = 700) {
  const [value, setValue] = React.useState(0);
  const shownRef = React.useRef(0);

  React.useEffect(() => {
    if (!Number.isFinite(target)) return;
    const from = shownRef.current;
    if (from === target) return;
    const reduced = window.matchMedia(REDUCED_MOTION).matches;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - start) / duration);
      const next = t >= 1 ? target : from + (target - from) * (1 - (1 - t) ** 3);
      shownRef.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
