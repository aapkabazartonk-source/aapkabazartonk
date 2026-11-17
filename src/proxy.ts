import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  decryptSession,
} from "@/lib/session-crypto";

const PUBLIC_PAGE_PATHS = new Set([
  "/login",
  "/forgot-password",
]);

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

function isPublicApi(pathname: string) {
  return (
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout"
  );
}

function isStaticOrNext(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff2?)$/i.test(pathname)
  );
}

async function hasValidSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decryptSession(token);
  return Boolean(session?.userId);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticOrNext(pathname)) {
    return NextResponse.next();
  }

  // Public registration is intentionally unavailable.
  if (pathname === "/register" || pathname.startsWith("/register/")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const authenticated = await hasValidSession(request);
  const forceReauth = request.nextUrl.searchParams.get("reauth") === "1";

  if (pathname.startsWith("/api/")) {
    if (isPublicApi(pathname)) {
      return NextResponse.next();
    }
    if (!authenticated) {
      return clearSessionCookie(
        NextResponse.json(
          { error: "Sign in is required." },
          { status: 401 },
        ),
      );
    }
    return NextResponse.next();
  }

  if (PUBLIC_PAGE_PATHS.has(pathname)) {
    // Stale JWT (valid signature, revoked sessionVersion) still decrypts in
    // the proxy. ?reauth=1 lets the login page load and drops the cookie.
    if (authenticated && !forceReauth) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    const response = NextResponse.next();
    if (forceReauth) {
      clearSessionCookie(response);
    }
    return response;
  }

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(authenticated ? "/dashboard" : "/login", request.url),
    );
  }

  if (!authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
