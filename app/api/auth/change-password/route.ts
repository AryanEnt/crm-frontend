import { NextResponse } from "next/server";
import {
  applyAuthCookies,
  backendFetch,
  readAccessToken,
  refreshAccessTokens,
  type BackendEnvelope,
} from "@/lib/auth/server";
import type { SessionUser } from "@/features/auth/types";

type AuthPayload = {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
};

export async function POST(req: Request) {
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
  const upstream = await backendFetch("/api/v1/auth/change-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access}`,
    },
    body: JSON.stringify(body),
  });

  const envelope = (await upstream.json()) as BackendEnvelope<AuthPayload>;
  if (!upstream.ok || !envelope.success || !envelope.data) {
    return NextResponse.json(envelope, { status: upstream.status });
  }

  const res = NextResponse.json({
    success: true,
    data: { user: envelope.data.user },
    timestamp: new Date().toISOString(),
  });

  return applyAuthCookies(res, {
    accessToken: envelope.data.accessToken,
    refreshToken: envelope.data.refreshToken,
  });
}
