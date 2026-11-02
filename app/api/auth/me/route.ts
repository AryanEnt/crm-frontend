import { NextResponse } from "next/server";
import {
  applyAuthCookies,
  backendFetch,
  readAccessToken,
  readEnvelope,
  refreshAccessTokens,
} from "@/lib/auth/server";
import type { SessionUser } from "@/features/auth/types";

export async function GET(req: Request) {
  let access = await readAccessToken();
  let upstream = await backendFetch("/api/v1/auth/me", {
    method: "GET",
    headers: access ? { Authorization: `Bearer ${access}` } : {},
  });

  if (upstream.status === 401) {
    const rotated = await refreshAccessTokens();
    if (rotated.status === "ok") {
      access = rotated.data.accessToken;
      upstream = await backendFetch("/api/v1/auth/me", {
        method: "GET",
        headers: { Authorization: `Bearer ${access}` },
      });
      const envelope = await readEnvelope<SessionUser>(upstream);
      const res = NextResponse.json(envelope, { status: upstream.status });
      return applyAuthCookies(res, {
        accessToken: rotated.data.accessToken,
        refreshToken: rotated.data.refreshToken,
        request: req,
      });
    }
    if (rotated.status === "unavailable") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "upstream_unavailable", message: rotated.message },
        },
        { status: 503 },
      );
    }
    // Real auth rejection only — middleware treats any refresh cookie as a session.
    const envelope = await readEnvelope<SessionUser>(upstream);
    const res = NextResponse.json(envelope, { status: upstream.status });
    return applyAuthCookies(res, { clear: true, request: req });
  }

  const envelope = await readEnvelope<SessionUser>(upstream);
  return NextResponse.json(envelope, { status: upstream.status });
}

export async function PATCH(req: Request) {
  let access = await readAccessToken();
  if (!access) {
    const rotated = await refreshAccessTokens();
    if (rotated.status === "ok") access = rotated.data.accessToken;
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
    if (rotated.status === "ok") {
      upstream = await backendFetch("/api/v1/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${rotated.data.accessToken}`,
        },
        body: JSON.stringify(body),
      });
      const envelope = await readEnvelope<SessionUser>(upstream);
      const res = NextResponse.json(envelope, { status: upstream.status });
      return applyAuthCookies(res, {
        accessToken: rotated.data.accessToken,
        refreshToken: rotated.data.refreshToken,
        request: req,
      });
    }
  }

  const envelope = await readEnvelope<SessionUser>(upstream);
  return NextResponse.json(envelope, { status: upstream.status });
}
