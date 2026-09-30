"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { DARK_QUERY, isLightOnlyPath, THEME_STORAGE_KEY as STORAGE_KEY } from "./theme-script";

export type ThemePreference = "light" | "dark" | "system";

const EVENT = "aurora-theme";

function readPreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    // ignore
  }
  return "light";
}

function systemPrefersDark() {
  return window.matchMedia(DARK_QUERY).matches;
}

function resolve(preference: ThemePreference): "light" | "dark" {
  if (preference === "system") return systemPrefersDark() ? "dark" : "light";
  return preference;
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
    media.removeEventListener("change", onChange);
  };
}

const serverSnapshot = () => "light" as ThemePreference;

export function useTheme() {
  const preference = React.useSyncExternalStore(subscribe, readPreference, serverSnapshot);
  const resolved = React.useSyncExternalStore(
    subscribe,
    () => resolve(readPreference()),
    () => "light" as const,
  );
  const setPreference = React.useCallback((value: ThemePreference) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { preference, resolved, setPreference };
}

/** Keeps `data-theme` on <html> in sync with the stored preference and the OS setting. */
export function ThemeSync() {
  const { resolved } = useTheme();
  const theme = isLightOnlyPath(usePathname()) ? "light" : resolved;
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  return null;
}
