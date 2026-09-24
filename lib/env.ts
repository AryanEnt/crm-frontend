/**
 * Frontend environment configuration.
 * Public values must be prefixed with NEXT_PUBLIC_.
 */

export const env = {
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  /** Direct Go API URL (server-side / BFF only). */
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
  /** Browser calls go through the Next.js BFF proxy (httpOnly session). */
  apiProxyBaseUrl: "/api/proxy",
  isDevelopment:
    (process.env.NEXT_PUBLIC_APP_ENV ?? "development") === "development",
} as const;
