import { hashPassword } from "../../src/lib/password.ts";
import { resolveTenantContext } from "../../src/lib/tenant.ts";
import { requireTenantInfrastructure } from "../../src/lib/tenant-bootstrap.ts";
import { Business } from "../../src/models/Business.ts";
import { Store } from "../../src/models/Store.ts";
import { User } from "../../src/models/User.ts";

/**
 * Integration tests call service/DAL code with a resolved owner context.
 * They do not invent unauthenticated bootstrap access.
 */
export async function resolveTestOwnerTenant() {
  await requireTenantInfrastructure();

  const business = await Business.findOne({
    code: "DEFAULT",
    isActive: true,
  });
  if (!business) {
    throw new Error("DEFAULT business missing for tests.");
  }

  const store = await Store.findOne({
    businessId: business._id,
    isDefault: true,
    isActive: true,
  });
  if (!store) {
    throw new Error("DEFAULT store missing for tests.");
  }

  let owner = await User.findOne({ role: "owner", isActive: true }).sort({
    createdAt: 1,
  });

  if (!owner) {
    owner = await User.create({
      name: "Test Owner",
      email: `owner-test-${Date.now()}@example.com`,
      passwordHash: await hashPassword("test-password-123"),
      role: "owner",
      businessId: business._id,
      defaultStoreId: store._id,
      isActive: true,
      sessionVersion: 0,
    });
  } else if (!owner.businessId) {
    owner.businessId = business._id;
    owner.defaultStoreId = store._id;
    await owner.save();
  }

  return resolveTenantContext({
    userId: String(owner._id),
    sessionVersion: owner.sessionVersion ?? 0,
  });
}
