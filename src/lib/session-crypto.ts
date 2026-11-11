import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const SESSION_COOKIE_NAME = "ab_session";

export type SessionPayload = {
  userId: string;
  sessionVersion: number;
  rememberMe: boolean;
};

type SessionClaims = JWTPayload & SessionPayload;

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters.",
    );
  }
  return new TextEncoder().encode(secret);
}

export function sessionMaxAgeSeconds(rememberMe: boolean) {
  return rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 12;
}

export async function encryptSession(
  payload: SessionPayload,
  maxAgeSeconds: number,
) {
  return new SignJWT({
    userId: payload.userId,
    sessionVersion: payload.sessionVersion,
    rememberMe: payload.rememberMe,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(getSecretKey());
}

export async function decryptSession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    const claims = payload as SessionClaims;
    if (!claims.userId || typeof claims.userId !== "string") return null;
    return {
      userId: claims.userId,
      sessionVersion:
        typeof claims.sessionVersion === "number" ? claims.sessionVersion : 0,
      rememberMe: Boolean(claims.rememberMe),
    };
  } catch {
    return null;
  }
}

export function readCookieValue(
  cookieHeader: string | null | undefined,
  name: string,
) {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return undefined;
}
