import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const ACCESS_COOKIE = "crm_access_token";
export const REFRESH_COOKIE = "crm_refresh_token";

/** Legacy refresh cookie path from earlier builds — clear via header append only. */
const LEGACY_REFRESH_PATH = "/api/auth";

export function apiBaseUrl() {
  return (
    process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:8080"
  ).replace(/\/$/, "");
}

export async function backendFetch(path: string, init: RequestInit = {}) {
  const url = `${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  // Headers instances must not be object-spread — that drops Authorization/Cookie.
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  return fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });
}

type CookieOptions = {
  accessToken?: string;
  refreshToken?: string;
  accessMaxAge?: number;
  refreshMaxAge?: number;
  clear?: boolean;
};

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

function legacyRefreshClearHeader(secure: boolean) {
  const parts = [
    `${REFRESH_COOKIE}=`,
    `Path=${LEGACY_REFRESH_PATH}`,
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export async function applyAuthCookies(res: NextResponse, opts: CookieOptions) {
  const secure = process.env.NODE_ENV === "production";
  if (opts.clear) {
    res.cookies.set(ACCESS_COOKIE, "", { ...cookieBase, secure, maxAge: 0 });
    res.cookies.set(REFRESH_COOKIE, "", { ...cookieBase, secure, maxAge: 0 });
    // Append — do not cookies.set again (Next overwrites same-name cookies).
    res.headers.append("Set-Cookie", legacyRefreshClearHeader(secure));
    return res;
  }
  if (opts.accessToken) {
    res.cookies.set(ACCESS_COOKIE, opts.accessToken, {
      ...cookieBase,
      secure,
      maxAge: opts.accessMaxAge ?? 60 * 15,
    });
  }
  if (opts.refreshToken) {
    // Path "/" so middleware and /api/proxy can read it for silent refresh.
    res.cookies.set(REFRESH_COOKIE, opts.refreshToken, {
      ...cookieBase,
      secure,
      maxAge: opts.refreshMaxAge ?? 60 * 60 * 24 * 7,
    });
    res.headers.append("Set-Cookie", legacyRefreshClearHeader(secure));
  }
  return res;
}

export async function readAccessToken() {
  const jar = await cookies();
  return jar.get(ACCESS_COOKIE)?.value ?? "";
}

export async function readRefreshToken() {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value ?? "";
}

export type BackendEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: Record<string, unknown> };
  meta?: Record<string, unknown>;
  timestamp?: string;
};

export type RotatedAuth = {
  accessToken: string;
  refreshToken: string;
  user?: unknown;
};

/**
 * Single-flight refresh so parallel page loads (e.g. Users → /users + /roles)
 * do not rotate the same refresh token twice and wipe the session.
 */
let refreshInFlight: Promise<RotatedAuth | null> | null = null;

export async function refreshAccessTokens(): Promise<RotatedAuth | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refresh = await readRefreshToken();
      if (!refresh) return null;
      const upstream = await backendFetch("/api/v1/auth/refresh", {
        method: "POST",
        headers: { Cookie: `${REFRESH_COOKIE}=${refresh}` },
      });
      const envelope = (await upstream.json()) as BackendEnvelope<RotatedAuth>;
      if (!upstream.ok || !envelope.success || !envelope.data) return null;
      return envelope.data;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}
