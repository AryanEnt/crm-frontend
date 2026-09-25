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
  let upstream = await backendFetch("/api/v1/auth/me", {
    method: "GET",
    headers: access ? { Authorization: `Bearer ${access}` } : {},
  });

  if (upstream.status === 401) {
    const rotated = await refreshAccessTokens();
    if (rotated?.accessToken) {
      access = rotated.accessToken;
      upstream = await backendFetch("/api/v1/auth/me", {
        method: "GET",
        headers: { Authorization: `Bearer ${access}` },
      });
      const envelope = (await upstream.json()) as BackendEnvelope<SessionUser>;
      const res = NextResponse.json(envelope, { status: upstream.status });
      return applyAuthCookies(res, {
        accessToken: rotated.accessToken,
        refreshToken: rotated.refreshToken,
      });
    }
  }

  const envelope = (await upstream.json()) as BackendEnvelope<SessionUser>;
  return NextResponse.json(envelope, { status: upstream.status });
}

export async function PATCH(req: Request) {
  let access = await readAccessToken();
  if (!access) {
    const rotated = await refreshAccessTokens();
    access = rotated?.accessToken ?? "";
  }
  if (!access) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "unauthorized", message: "authentication required" },
      },
      { status: 401 },
    );
  }

  const body = await req.json();
  let upstream = await backendFetch("/api/v1/auth/me", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access}`,
    },
    body: JSON.stringify(body),
  });

  if (upstream.status === 401) {
    const rotated = await refreshAccessTokens();
    if (rotated?.accessToken) {
      upstream = await backendFetch("/api/v1/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${rotated.accessToken}`,
        },
        body: JSON.stringify(body),
      });
      const envelope = (await upstream.json()) as BackendEnvelope<SessionUser>;
      const res = NextResponse.json(envelope, { status: upstream.status });
      return applyAuthCookies(res, {
        accessToken: rotated.accessToken,
        refreshToken: rotated.refreshToken,
      });
    }
  }

  const envelope = (await upstream.json()) as BackendEnvelope<SessionUser>;
  return NextResponse.json(envelope, { status: upstream.status });
}
