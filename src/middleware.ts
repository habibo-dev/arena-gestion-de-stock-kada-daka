import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "autostock_session";
const PUBLIC_PATHS = ["/connexion"];

/**
 * Lightweight edge guard: redirects anonymous visitors to the login page.
 * The real authorization check (session validity, permissions) happens in the
 * server components / actions via `requireUser()` / `requirePermission()`.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!hasCookie && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname + req.nextUrl.search)}` : "";
    return NextResponse.redirect(url);
  }
  if (hasCookie && pathname === "/connexion") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/images).*)"],
};
