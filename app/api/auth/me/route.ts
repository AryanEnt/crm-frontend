import { NextResponse } from "next/server";
import {
  applyAuthCookies,
  backendFetch,
  readAccessToken,
  refreshAccessTokens,
  type BackendEnvelope,
} from "@/lib/auth/server";
import type { SessionUser } from "@/features/auth/types";

export async function GET() {
  let access = await readAccessToken();
  let rotated: Awaited<ReturnType<typeof refreshAccessTokens>> = null;

  if (!access) {
    rotated = await refreshAccessTokens();
    if (!rotated) {
      const res = NextResponse.json(
        {
          success: false,
          error: { code: "unauthorized", message: "Not authenticated" },
        },
        { status: 401 },
      );
      return applyAuthCookies(res, { clear: true });
    }
    access = rotated.accessToken;
  }

  let upstream = await backendFetch("/api/v1/auth/me", {
    headers: { Authorization: `Bearer ${access}` },
  });

  if (upstream.status === 401) {
    rotated = await refreshAccessTokens();
    if (!rotated) {
      const res = NextResponse.json(
        {
          success: false,
          error: { code: "unauthorized", message: "Session expired" },
        },
        { status: 401 },
      );
      return applyAuthCookies(res, { clear: true });
    }
    access = rotated.accessToken;
    upstream = await backendFetch("/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${access}` },
    });
  }

  const envelope = (await upstream.json()) as BackendEnvelope<SessionUser>;
  const res = NextResponse.json(envelope, { status: upstream.status });

  // Only clear session on auth failure — not on 5xx / validation errors.
  if (upstream.status === 401) {
    return applyAuthCookies(res, { clear: true });
  }
  if (rotated) {
    return applyAuthCookies(res, {
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
    });
  }
  return res;
}
