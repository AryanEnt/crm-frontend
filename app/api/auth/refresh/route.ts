import { NextResponse } from "next/server";
import {
  applyAuthCookies,
  refreshAccessTokens,
} from "@/lib/auth/server";

export async function POST(req: Request) {
  const rotated = await refreshAccessTokens();
  if (rotated.status !== "ok") {
    const res = NextResponse.json(
      {
        success: false,
        error: {
          code: rotated.status === "unavailable" ? "upstream_unavailable" : "unauthorized",
          message: rotated.message,
        },
      },
      { status: rotated.status === "unavailable" ? 503 : 401 },
    );
    // Only wipe cookies when the refresh token itself was rejected.
    if (rotated.status === "rejected") {
      return applyAuthCookies(res, { clear: true, request: req });
    }
    return res;
  }

  const res = NextResponse.json({
    success: true,
    data: { user: rotated.data.user ?? null },
    timestamp: new Date().toISOString(),
  });
  return applyAuthCookies(res, {
    accessToken: rotated.data.accessToken,
    refreshToken: rotated.data.refreshToken,
    request: req,
  });
}
