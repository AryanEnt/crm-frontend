import { NextResponse } from "next/server";
import {
  applyAuthCookies,
  backendFetch,
  readRefreshToken,
} from "@/lib/auth/server";

export async function POST() {
  const refresh = await readRefreshToken();
  await backendFetch("/api/v1/auth/logout", {
    method: "POST",
    headers: refresh ? { Cookie: `crm_refresh_token=${refresh}` } : {},
  });

  const res = NextResponse.json({
    success: true,
    data: { loggedOut: true },
    timestamp: new Date().toISOString(),
  });
  return applyAuthCookies(res, { clear: true });
}
