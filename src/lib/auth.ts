/**
 * Auth is a UI shell in Phases 1–3. Login does not create a session.
 *
 * Do not read a user id or businessId from the client here.
 * When sign-in is implemented, return the session user id only.
 * Business membership is resolved in src/lib/tenant.ts from User.businessId.
 */
export type AuthContext = {
  userId: string | null;
};

export async function getAuthContext(_request?: Request): Promise<AuthContext> {
  return { userId: null };
}
