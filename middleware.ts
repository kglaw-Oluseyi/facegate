import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STAFF_EVENT_COOKIE = "fg-staff-event-id";

function isAdminConsolePath(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/events") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/people") ||
    pathname.startsWith("/platform") ||
    pathname.startsWith("/api-docs")
  );
}

function isStaffWorkspacePath(pathname: string): boolean {
  return pathname.startsWith("/staff");
}

function requiresLogin(pathname: string): boolean {
  return isAdminConsolePath(pathname) || isStaffWorkspacePath(pathname);
}

function staffWorkspaceAllowed(role: string | undefined): boolean {
  return (
    role === "STAFF" ||
    role === "SUPERVISOR" ||
    role === "ADMIN" ||
    role === "PLATFORM_ADMIN"
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const isLogin = pathname === "/login" || pathname.startsWith("/login/");

  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  const token = await getToken({
    req,
    secret,
    secureCookie: process.env.NODE_ENV === "production",
  });
  const authed = !!token;
  const role = (token as Record<string, unknown> | null)?.role as string | undefined;

  if (isLogin) {
    if (authed) {
      const destination =
        role === "PLATFORM_ADMIN" ? "/dashboard" : "/staff/select-event";
      return NextResponse.redirect(new URL(destination, req.url));
    }
    return NextResponse.next();
  }

  if (requiresLogin(pathname) && !authed) {
    const signInUrl = new URL("/login", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (authed && role) {
    if (isAdminConsolePath(pathname) && (role === "STAFF" || role === "SUPERVISOR")) {
      return NextResponse.redirect(new URL("/staff/select-event", req.url));
    }

    if (isStaffWorkspacePath(pathname)) {
      if (!staffWorkspaceAllowed(role)) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }

      const skipEventGuard =
        pathname.startsWith("/staff/select-event") || pathname === "/staff/select-event";
      if (!skipEventGuard) {
        const ev = req.cookies.get(STAFF_EVENT_COOKIE)?.value;
        if (!ev) {
          return NextResponse.redirect(new URL("/staff/select-event", req.url));
        }
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/dashboard/:path*",
    "/events/:path*",
    "/people/:path*",
    "/settings/:path*",
    "/platform/:path*",
    "/api-docs",
    "/staff/:path*",
    "/login",
  ],
};
