import { Types } from "mongoose";
import { getAuthContext, type AuthContext } from "@/lib/auth";
import { isValidObjectId } from "@/lib/api";
import type { UserRole } from "@/lib/constants";
import { connectToDatabase } from "@/lib/db";
import { normalizeRole } from "@/lib/permissions";
import { requireTenantInfrastructure } from "@/lib/tenant-bootstrap";
import { Business } from "@/models/Business";
import { Store } from "@/models/Store";
import { User } from "@/models/User";

export { requireTenantInfrastructure } from "@/lib/tenant-bootstrap";

/**
 * Business context for every inventory and catalog query.
 *
 * Single-store owner auth: getAuthContext() must return the signed-in owner's
 * id from the HttpOnly session cookie. Do not read businessId from the client.
 * Membership comes from User.businessId / defaultStoreId (linked to DEFAULT).
 *
 * Unauthenticated requests are rejected. Existing catalog data stays scoped to
 * the owner's businessId — no multi-tenant switching.
 */
export class TenantError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "TenantError";
    this.status = status;
  }
}

export type TenantContext = {
  businessId: Types.ObjectId;
  storeId: Types.ObjectId;
  userId: string | null;
  role: UserRole;
  reorderMultiple: number;
  /** True when the request is backed by a real signed-in owner session. */
  authIntegrated: boolean;
};

export async function requireTenant(request?: Request): Promise<TenantContext> {
  const auth = await getAuthContext(request);
  return resolveTenantContext(auth);
}

export async function resolveTenantContext(
  auth: AuthContext,
): Promise<TenantContext> {
  await connectToDatabase();
  await requireTenantInfrastructure();

  if (!auth.userId) {
    throw new TenantError("Sign in is required.", 401);
  }

  if (!isValidObjectId(auth.userId)) {
    throw new TenantError("Authenticated user is invalid.", 401);
  }

  const user = await User.findById(auth.userId)
    .select("businessId defaultStoreId isActive role sessionVersion")
    .lean<{
      businessId?: Types.ObjectId | null;
      defaultStoreId?: Types.ObjectId | null;
      isActive?: boolean;
      role?: string;
      sessionVersion?: number;
    } | null>();

  if (!user || user.isActive === false) {
    throw new TenantError("Sign in is required.", 401);
  }

  if (
    typeof auth.sessionVersion === "number" &&
    (user.sessionVersion ?? 0) !== auth.sessionVersion
  ) {
    throw new TenantError("Session expired. Please sign in again.", 401);
  }

  if (!user.businessId) {
    throw new TenantError(
      "This owner account is not linked to the store. Re-run owner bootstrap or set User.businessId.",
      403,
    );
  }

  const business = await Business.findOne({
    _id: user.businessId,
    isActive: true,
  }).lean();

  if (!business) {
    throw new TenantError("Business not found for this user.", 403);
  }

  const store = user.defaultStoreId
    ? await Store.findOne({
        _id: user.defaultStoreId,
        businessId: business._id,
        isActive: true,
      }).lean()
    : await Store.findOne({
        businessId: business._id,
        isDefault: true,
        isActive: true,
      }).lean();

  if (!store) {
    throw new TenantError("This business has no active store.", 403);
  }

  return {
    businessId: business._id,
    storeId: store._id,
    userId: auth.userId,
    role: normalizeRole(user.role),
    reorderMultiple: business.reorderMultiple ?? 2,
    authIntegrated: true,
  };
}
