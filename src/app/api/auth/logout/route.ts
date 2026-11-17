import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session-crypto";

/**
 * Clear the session cookie only.
 * Password reset / change still bumps sessionVersion to revoke stolen tokens.
 * Logout no longer bumps the version so a flaky client retry cannot
 * invalidate a freshly issued login cookie.
 */
export async function POST() {
  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
