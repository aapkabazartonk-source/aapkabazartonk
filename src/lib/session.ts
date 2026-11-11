import "server-only";

import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  decryptSession,
  encryptSession,
  sessionMaxAgeSeconds,
  type SessionPayload,
} from "@/lib/session-crypto";

export { SESSION_COOKIE_NAME, decryptSession, type SessionPayload };

export async function createSession(input: {
  userId: string;
  sessionVersion: number;
  rememberMe?: boolean;
}) {
  const rememberMe = Boolean(input.rememberMe);
  const maxAge = sessionMaxAgeSeconds(rememberMe);
  const token = await encryptSession(
    {
      userId: input.userId,
      sessionVersion: input.sessionVersion,
      rememberMe,
    },
    maxAge,
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return decryptSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}
