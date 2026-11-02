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
  try {
    return await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (err) {
    console.error(`[backendFetch] backend unreachable at ${url}`, err);
    return upstreamUnavailable();
  }
}

function upstreamUnavailable() {
  return Response.json(
    {
      success: false,
      error: { code: "upstream_unavailable", message: "Backend service is unavailable" },
      timestamp: new Date().toISOString(),
    },
    { status: 502 },
  );
}

/** Backend replies that are not JSON (e.g. a platform 502 page) become an upstream_unavailable envelope. */
export async function readEnvelope<T>(upstream: Response): Promise<BackendEnvelope<T>> {
  const text = await upstream.text();
  try {
    return JSON.parse(text) as BackendEnvelope<T>;
  } catch {
    console.error(
      `[backendFetch] non-JSON response (${upstream.status}) from ${upstream.url}: ${text.slice(0, 200)}`,
    );
    return {
      success: false,
      error: { code: "upstream_unavailable", message: "Backend service is unavailable" },
      timestamp: new Date().toISOString(),
    };
  }
}

type CookieOptions = {
  accessToken?: string;
  refreshToken?: string;
  accessMaxAge?: number;
  refreshMaxAge?: number;
  clear?: boolean;
  /** Incoming request — used to set Secure only on HTTPS (LAN HTTP must omit Secure). */
  request?: Request;
};

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

/** Private / link-local hosts — Secure cookies would be dropped by the browser over plain HTTP. */
function isLanOrLocalHost(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}

/**
 * Secure cookies require HTTPS. Production + plain HTTP (e.g. http://10.x.x.x) must not
 * set Secure or the browser drops the session → "session expired" / JSON proxy errors.
 *
 * Override: COOKIE_SECURE=true|false
 */
export function resolveCookieSecure(request?: Request): boolean {
  const override = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (override === "true" || override === "1") return true;
  if (override === "false" || override === "0") return false;

  if (request) {
    const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (forwarded === "https") return true;
    if (forwarded === "http") return false;
    try {
      const url = new URL(request.url);
      if (url.protocol === "https:") return true;
      if (url.protocol === "http:") return false;
    } catch {
      /* ignore */
    }
    // Host header fallback when request.url is opaque / rewritten.
    const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
      .split(",")[0]
      ?.trim()
      .split(":")[0];
    if (host && isLanOrLocalHost(host)) return false;
  }

  return process.env.NODE_ENV === "production";
}

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
  const secure = resolveCookieSecure(opts.request);
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

export type RefreshResult =
  | { status: "ok"; data: RotatedAuth }
  /** Refresh token missing or explicitly rejected — safe to clear cookies. */
  | { status: "rejected"; message: string }
  /** API down / timeout / non-JSON — keep cookies so the user is not logged out. */
  | { status: "unavailable"; message: string };

/**
 * Single-flight refresh so parallel page loads (e.g. Users → /users + /roles)
 * do not rotate the same refresh token twice and wipe the session.
 */
let refreshInFlight: Promise<RefreshResult> | null = null;

export async function refreshAccessTokens(): Promise<RefreshResult> {
  if (!refreshInFlight) {
    refreshInFlight = (async (): Promise<RefreshResult> => {
      const refresh = await readRefreshToken();
      if (!refresh) {
        return { status: "rejected", message: "Authentication required" };
      }
      const upstream = await backendFetch("/api/v1/auth/refresh", {
        method: "POST",
        headers: { Cookie: `${REFRESH_COOKIE}=${refresh}` },
      });
      const envelope = await readEnvelope<RotatedAuth>(upstream);
      if (envelope.error?.code === "upstream_unavailable" || upstream.status === 502) {
        return {
          status: "unavailable",
          message: envelope.error?.message || "Authentication service is unavailable",
        };
      }
      if (upstream.status === 401 || upstream.status === 403) {
        return {
          status: "rejected",
          message: envelope.error?.message || "Session expired",
        };
      }
      if (!upstream.ok || !envelope.success || !envelope.data?.accessToken) {
        // Ambiguous failure (HTML 500, etc.) — do not wipe cookies.
        return {
          status: "unavailable",
          message: envelope.error?.message || "Could not renew the session. Try again.",
        };
      }
      return { status: "ok", data: envelope.data };
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}
