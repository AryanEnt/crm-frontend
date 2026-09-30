import { NextResponse } from "next/server";
import {
  applyAuthCookies,
  backendFetch,
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

function unavailable() {
  return NextResponse.json(
    {
      success: false,
      error: { code: "upstream_unavailable", message: "Authentication service is unavailable" },
      timestamp: new Date().toISOString(),
    },
    { status: 502 },
  );
}

export async function POST(req: Request) {
  const body = await req.json();
  let upstream: Response;
  let envelope: BackendEnvelope<AuthPayload>;
  try {
    upstream = await backendFetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    envelope = (await upstream.json()) as BackendEnvelope<AuthPayload>;
  } catch {
    return unavailable();
  }
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
