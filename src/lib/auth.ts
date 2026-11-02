/**
 * Auth is not wired in Phase 1–3 APIs yet.
 * These helpers keep inventory/purchase audit fields ready for later auth.
 */

export type AuthContext = {
  userId: string | null;
};

export async function getAuthContext(_request?: Request): Promise<AuthContext> {
  return { userId: null };
}
