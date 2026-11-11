import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  decryptSession,
  readCookieValue,
} from "@/lib/session-crypto";

/**
 * Single-owner session auth. Reads the sealed HttpOnly cookie only —
 * never trusts client-supplied user or business ids.
 */
export type AuthContext = {
  userId: string | null;
  sessionVersion: number | null;
};

export async function getAuthContext(request?: Request): Promise<AuthContext> {
  let token: string | undefined;

  if (request) {
    token = readCookieValue(
      request.headers.get("cookie"),
      SESSION_COOKIE_NAME,
    );
  } else {
    try {
      token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    } catch {
      token = undefined;
    }
  }

  const session = await decryptSession(token);
  if (!session?.userId) {
    return { userId: null, sessionVersion: null };
  }

  return {
    userId: session.userId,
    sessionVersion: session.sessionVersion,
  };
}
