import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, jsonError } from "@/lib/api";
import {
  assertLoginAllowed,
  clearLoginFailures,
  getClientIp,
  recordLoginFailure,
} from "@/lib/login-rate-limit";
import { verifyPassword } from "@/lib/password";
import {
  SESSION_COOKIE_NAME,
  encryptSession,
  sessionMaxAgeSeconds,
} from "@/lib/session-crypto";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";

const loginSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().optional().default(false),
});

const GENERIC_FAILURE = "Invalid email or password.";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.parse(body);
    const email = parsed.email.toLowerCase();
    const ip = getClientIp(request);

    try {
      assertLoginAllowed(ip, email);
    } catch (error) {
      const status =
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof (error as { status: unknown }).status === "number"
          ? (error as { status: number }).status
          : 429;
      return jsonError(
        error instanceof Error ? error.message : "Too many sign-in attempts.",
        status,
      );
    }

    await connectToDatabase();

    const user = await User.findOne({ email }).select(
      "+passwordHash name email role isActive sessionVersion passwordHash",
    );

    const passwordOk =
      user &&
      user.isActive !== false &&
      (await verifyPassword(parsed.password, user.passwordHash));

    if (!user || !passwordOk) {
      recordLoginFailure(ip, email);
      return jsonError(GENERIC_FAILURE, 401);
    }

    clearLoginFailures(ip, email);

    const rememberMe = Boolean(parsed.rememberMe);
    const maxAge = sessionMaxAgeSeconds(rememberMe);
    const token = await encryptSession(
      {
        userId: String(user._id),
        sessionVersion: user.sessionVersion ?? 0,
        rememberMe,
      },
      maxAge,
    );

    const response = NextResponse.json({
      data: {
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
