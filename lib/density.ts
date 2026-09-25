"use client";

import * as React from "react";

export type Density = "compact" | "comfortable";

const STORAGE_KEY = "aurora.density";
const EVENT = "aurora-density";

function readDensity(): Density {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "comfortable" || v === "compact") return v;
  } catch {
    // ignore
  }
  return "compact";
}

function writeDensity(value: Density) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const handler = () => onChange();
  window.addEventListener("storage", handler);
  window.addEventListener(EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(EVENT, handler);
  };
}

/** Sync density onto documentElement for CSS `[data-density]`. */
export function DensityProvider({ children }: { children: React.ReactNode }) {
  const density = React.useSyncExternalStore(subscribe, readDensity, () => "compact" as Density);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
  }, [density]);

  return children;
}

export function useDensity() {
  const density = React.useSyncExternalStore(subscribe, readDensity, () => "compact" as Density);
  const setDensity = React.useCallback((value: Density) => {
    writeDensity(value);
  }, []);
  const toggle = React.useCallback(() => {
    writeDensity(density === "compact" ? "comfortable" : "compact");
  }, [density]);
  return { density, setDensity, toggle };
}
