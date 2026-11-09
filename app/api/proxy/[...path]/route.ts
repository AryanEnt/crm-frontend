import { NextRequest, NextResponse } from "next/server";
import {
  applyAuthCookies,
  backendFetch,
  readAccessToken,
  refreshAccessTokens,
} from "@/lib/auth/server";

/** SMTP send can take several seconds; avoid platform killing the proxy mid-request. */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Reject cross-site state-changing calls (defense-in-depth with SameSite=Lax cookies). */
function assertSameOrigin(req: NextRequest): NextResponse | null {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return null;
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return null;

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "forbidden", message: "Cross-origin request blocked" },
          },
          { status: 403 },
        );
      }
      return null;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: { code: "forbidden", message: "Invalid origin" },
        },
        { status: 403 },
      );
    }
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      if (new URL(referer).host !== host) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "forbidden", message: "Cross-origin request blocked" },
          },
          { status: 403 },
        );
      }
    } catch {
      /* ignore bad referer */
    }
  }
  return null;
}

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

async function forward(req: NextRequest, path: string[], accessToken: string) {
  const search = req.nextUrl.search;
  const target = `/api/v1/${path.join("/")}${search}`;
  const headers = new Headers();
  headers.set("Accept", req.headers.get("Accept") ?? "*/*");
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const init: RequestInit = {
    method: req.method,
    headers,
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }
  return backendFetch(target, init);
}

async function unauthorized(req: NextRequest, message: string, clearCookies: boolean) {
  const res = jsonError(401, "unauthorized", message);
  if (!clearCookies) return res;
  return applyAuthCookies(res, { clear: true, request: req });
}

async function handle(req: NextRequest, path: string[]) {
  try {
    const originBlock = assertSameOrigin(req);
    if (originBlock) return originBlock;

    const isPublicHealth = path.length === 1 && path[0] === "health";

    if (isPublicHealth) {
      return proxyResponse(await forward(req, path, ""));
    }

    let access = await readAccessToken();
    let rotated: Awaited<ReturnType<typeof refreshAccessTokens>> | null = null;

    if (!access) {
      rotated = await refreshAccessTokens();
      if (rotated.status === "ok") {
        access = rotated.data.accessToken;
      } else if (rotated.status === "unavailable") {
        return jsonError(503, "upstream_unavailable", rotated.message);
      } else {
        return unauthorized(req, rotated.message, true);
      }
    }

    let upstream = await forward(req, path, access);
    if (upstream.status === 401) {
      rotated = await refreshAccessTokens();
      if (rotated.status === "ok") {
        access = rotated.data.accessToken;
        upstream = await forward(req, path, access);
      } else if (rotated.status === "unavailable") {
        // Keep cookies — API blip / timeout during mail send must not log the user out.
        return jsonError(503, "upstream_unavailable", rotated.message);
      } else {
        return unauthorized(req, rotated.message, true);
      }
    }

    const res = await proxyResponse(upstream);
    if (rotated?.status === "ok") {
      return applyAuthCookies(res, {
        accessToken: rotated.data.accessToken,
        refreshToken: rotated.data.refreshToken,
        request: req,
      });
    }
    return res;
  } catch (err) {
    console.error("[api/proxy]", path.join("/"), err);
    return jsonError(
      502,
      "upstream_unavailable",
      err instanceof Error && err.message
        ? `Proxy error: ${err.message}`
        : "Proxy error talking to the API. Check API_INTERNAL_URL and that the backend is running.",
    );
  }
}

async function proxyResponse(upstream: Response) {
  const contentType = upstream.headers.get("Content-Type") ?? "application/json";
  const disposition = upstream.headers.get("Content-Disposition");
  const isBinary =
    !contentType.includes("application/json") &&
    !contentType.startsWith("text/");

  if (isBinary) {
    const body = await upstream.arrayBuffer();
    const headers: Record<string, string> = { "Content-Type": contentType };
    if (disposition) headers["Content-Disposition"] = disposition;
    const nosniff = upstream.headers.get("X-Content-Type-Options");
    if (nosniff) headers["X-Content-Type-Options"] = nosniff;
    return new NextResponse(body, { status: upstream.status, headers });
  }

  const text = await upstream.text();
  if (!contentType.includes("application/json")) {
    let parsed: unknown = null;
    try {
      parsed = text.trim() ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    if (parsed && typeof parsed === "object") {
      return NextResponse.json(parsed, { status: upstream.status });
    }
    return NextResponse.json(
      {
        success: false,
        error: {
          code: upstream.status >= 500 ? "upstream_unavailable" : "invalid_response",
          message:
            upstream.status >= 500
              ? "Backend service is unavailable or timed out while sending mail"
              : `Upstream returned a non-JSON response (${upstream.status})`,
        },
      },
      { status: upstream.status >= 400 ? upstream.status : 502 },
    );
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (disposition) headers["Content-Disposition"] = disposition;
  return new NextResponse(text, { status: upstream.status, headers });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handle(req, path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handle(req, path);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handle(req, path);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handle(req, path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handle(req, path);
}
