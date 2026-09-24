import { NextResponse } from "next/server";
import {
  applyAuthCookies,
  refreshAccessTokens,
} from "@/lib/auth/server";

export async function POST() {
  const rotated = await refreshAccessTokens();
  if (!rotated) {
    const res = NextResponse.json(
      {
        success: false,
        error: { code: "unauthorized", message: "No refresh session" },
      },
      { status: 401 },
    );
    return applyAuthCookies(res, { clear: true });
  }

  const res = NextResponse.json({
    success: true,
    data: { user: rotated.user ?? null },
    timestamp: new Date().toISOString(),
  });
  return applyAuthCookies(res, {
    accessToken: rotated.accessToken,
    refreshToken: rotated.refreshToken,
  });
}
