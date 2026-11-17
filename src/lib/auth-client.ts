"use client";

const REDIRECT_KEY = "ab_auth_redirecting";

/** Redirect once to login when the session is gone. Prevents login↔dashboard loops. */
export function redirectToLogin(nextPath?: string) {
  if (typeof window === "undefined") return;

  const path = window.location.pathname;
  if (path === "/login" || path === "/forgot-password") {
    sessionStorage.removeItem(REDIRECT_KEY);
    return;
  }

  if (sessionStorage.getItem(REDIRECT_KEY) === "1") return;
  sessionStorage.setItem(REDIRECT_KEY, "1");

  const next = nextPath || `${path}${window.location.search}`;
  const login = new URL("/login", window.location.origin);
  login.searchParams.set("reauth", "1");
  if (next && next !== "/login") {
    login.searchParams.set("next", next);
  }
  // Full navigation after the 401 response has cleared the cookie.
  window.location.replace(login.toString());
}

export function clearAuthRedirectFlag() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(REDIRECT_KEY);
}
