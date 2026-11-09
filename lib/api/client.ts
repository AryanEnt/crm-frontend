import { env } from "@/lib/env";
import { ApiError, type ApiEnvelope } from "@/types/api";

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  /**
   * Override base URL.
   * - default: Next.js BFF proxy (`/api/proxy`) which attaches httpOnly session
   * - "" for same-origin Next auth routes (`/api/auth/...`)
   */
  baseUrl?: string;
};

async function parseEnvelope<T>(res: Response): Promise<ApiEnvelope<T>> {
  const text = await res.text();
  if (!text.trim()) {
    throw new ApiError(
      res.status === 401 || res.status === 403
        ? "Session expired. Sign in again."
        : res.status >= 500
          ? "API returned an empty error. On the host, check API_INTERNAL_URL, backend logs, and SMTP outbound ports."
          : `Empty response from API (${res.status})`,
      {
        status: res.status || 502,
        code: res.status >= 500 ? "upstream_unavailable" : "invalid_response",
      },
    );
  }
  try {
    return JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    // Next/nginx HTML error pages (often still served by an old hosted build).
    const looksHtml = /<!doctype html|<html/i.test(text);
    throw new ApiError(
      looksHtml
        ? `Host returned an HTML error page (${res.status}). Redeploy the frontend, set COOKIE_SECURE=false and API_INTERNAL_URL to the backend, then restart.`
        : `API response was not JSON (${res.status}). Redeploy frontend/backend or check the API is reachable from the Next server.`,
      { status: res.status || 502, code: "invalid_response" },
    );
  }
}

function resolveUrl(path: string, baseUrl: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (baseUrl === "") {
    return normalizedPath;
  }
  return `${baseUrl.replace(/\/$/, "")}${normalizedPath}`;
}

/**
 * Centralized API client.
 * Auth tokens live in httpOnly cookies — never localStorage.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const baseUrl = options.baseUrl ?? env.apiProxyBaseUrl;
  const url = resolveUrl(path, baseUrl);

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      credentials: "same-origin",
    });
  } catch (err) {
    throw new ApiError(
      err instanceof Error ? err.message : "Network request failed",
      { status: 0, code: "network_error" },
    );
  }

  const envelope = await parseEnvelope<T>(res);

  if (!res.ok || !envelope.success) {
    throw new ApiError(envelope.error?.message ?? `Request failed (${res.status})`, {
      status: res.status,
      code: envelope.error?.code ?? "request_failed",
      details: envelope.error?.details,
    });
  }

  return envelope.data as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "DELETE" }),
};
