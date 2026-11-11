/**
 * Simple in-memory login rate limiting for a single-owner store.
 * Resets on process restart — enough to slow credential stuffing locally/prod
 * without introducing Redis for one account.
 */

type AttemptState = {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number;
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const LOCK_MS = 15 * 60 * 1000;

const attempts = new Map<string, AttemptState>();

function keyFor(ip: string, email: string) {
  return `${ip}|${email.toLowerCase()}`;
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function assertLoginAllowed(ip: string, email: string) {
  const key = keyFor(ip, email);
  const now = Date.now();
  const state = attempts.get(key);
  if (!state) return;

  if (state.lockedUntil > now) {
    const minutes = Math.max(1, Math.ceil((state.lockedUntil - now) / 60000));
    const error = new Error(
      `Too many sign-in attempts. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    );
    (error as Error & { status: number }).status = 429;
    throw error;
  }

  if (now - state.firstAttemptAt > WINDOW_MS) {
    attempts.delete(key);
  }
}

export function recordLoginFailure(ip: string, email: string) {
  const key = keyFor(ip, email);
  const now = Date.now();
  const existing = attempts.get(key);

  if (!existing || now - existing.firstAttemptAt > WINDOW_MS) {
    attempts.set(key, {
      count: 1,
      firstAttemptAt: now,
      lockedUntil: 0,
    });
    return;
  }

  existing.count += 1;
  if (existing.count >= MAX_ATTEMPTS) {
    existing.lockedUntil = now + LOCK_MS;
  }
  attempts.set(key, existing);
}

export function clearLoginFailures(ip: string, email: string) {
  attempts.delete(keyFor(ip, email));
}
