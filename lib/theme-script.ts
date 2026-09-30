export const THEME_STORAGE_KEY = "aurora.theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Pre-auth screens are designed for the light theme only. */
export const LIGHT_ONLY_PATHS = ["/login"];

export function isLightOnlyPath(pathname: string | null) {
  return pathname != null && LIGHT_ONLY_PATHS.includes(pathname);
}

/**
 * Inlined in <head> so `data-theme` is set before first paint (no flash of the wrong theme).
 * Mirrors `resolve()` in lib/theme.ts; the default preference is light.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var l=${JSON.stringify(LIGHT_ONLY_PATHS)}.indexOf(location.pathname)>=0;var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=!l&&(p==="dark"||(p==="system"&&matchMedia("${DARK_QUERY}").matches));document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();`;
