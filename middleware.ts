import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/privacy", "/terms"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === "/" ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/proxy") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  const hasSession =
    Boolean(req.cookies.get("crm_access_token")?.value) ||
    Boolean(req.cookies.get("crm_refresh_token")?.value);

  if (!isPublic && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
