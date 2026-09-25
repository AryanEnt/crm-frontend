import { NextRequest, NextResponse } from "next/server";
import {
  applyAuthCookies,
  backendFetch,
  readAccessToken,
  refreshAccessTokens,
} from "@/lib/auth/server";

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

async function forward(
  req: NextRequest,
  path: string[],
  accessToken: string,
) {
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
    // Preserve binary / multipart bodies (document uploads).
    init.body = await req.arrayBuffer();
  }
  return backendFetch(target, init);
}

async function unauthorized(message: string) {
  return applyAuthCookies(
    NextResponse.json(
      {
        success: false,
        error: { code: "unauthorized", message },
      },
      { status: 401 },
    ),
    { clear: true },
  );
}

async function handle(req: NextRequest, path: string[]) {
  const originBlock = assertSameOrigin(req);
  if (originBlock) return originBlock;

  const isPublicHealth = path.length === 1 && path[0] === "health";

  if (isPublicHealth) {
    const upstream = await forward(req, path, "");
    return proxyResponse(upstream);
  }

  let access = await readAccessToken();
  let rotated: Awaited<ReturnType<typeof refreshAccessTokens>> = null;

  if (!access) {
    rotated = await refreshAccessTokens();
    if (!rotated) {
      return unauthorized("Authentication required");
    }
    access = rotated.accessToken;
  }

  let upstream = await forward(req, path, access);
  if (upstream.status === 401) {
    rotated = await refreshAccessTokens();
    if (!rotated) {
      return unauthorized("Session expired");
    }
    access = rotated.accessToken;
    upstream = await forward(req, path, access);
  }

  const res = await proxyResponse(upstream);
  if (rotated) {
    return applyAuthCookies(res, {
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
    });
  }
  return res;
}

async function proxyResponse(upstream: Response) {
  const contentType = upstream.headers.get("Content-Type") ?? "application/json";
  const disposition = upstream.headers.get("Content-Disposition");
  const isBinary =
    !contentType.includes("application/json") &&
    !contentType.startsWith("text/");

  const body = isBinary ? await upstream.arrayBuffer() : await upstream.text();
  const headers: Record<string, string> = { "Content-Type": contentType };
  if (disposition) headers["Content-Disposition"] = disposition;

  return new NextResponse(body, {
    status: upstream.status,
    headers,
  });
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
