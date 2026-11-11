import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { SESSION_COOKIE_NAME } from "@/lib/session-crypto";
import { User } from "@/models/User";

export async function POST(request: Request) {
  const auth = await getAuthContext(request);

  if (auth.userId) {
    try {
      await connectToDatabase();
      await User.updateOne(
        { _id: auth.userId },
        { $inc: { sessionVersion: 1 } },
      );
    } catch {
      // Still clear the cookie even if the version bump fails.
    }
  }

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
