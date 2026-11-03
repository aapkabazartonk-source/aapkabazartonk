import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Root redirect via proxy avoids Cache Components / instant-prefetch conflicts with page-level redirect(). */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
