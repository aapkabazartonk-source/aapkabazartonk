import { Types } from "mongoose";
import { hashPassword } from "@/lib/password";
import { connectToDatabase } from "@/lib/db";
import {
  BOOTSTRAP_BUSINESS_CODE,
  requireTenantInfrastructure,
} from "@/lib/tenant-bootstrap";
import { Business } from "@/models/Business";
import { Store } from "@/models/Store";
import { User } from "@/models/User";

export type OwnerBootstrapResult =
  | {
      status: "created";
      userId: string;
      email: string;
      businessId: string;
      storeId: string;
    }
  | {
      status: "exists";
      userId: string;
      email: string;
      message: string;
    };

export async function ensureDefaultStoreScope() {
  await connectToDatabase();
  await requireTenantInfrastructure();

  const business = await Business.findOne({
    code: BOOTSTRAP_BUSINESS_CODE,
    isActive: true,
  }).lean();
  if (!business) {
    throw new Error("Default business is missing after bootstrap.");
  }

  const store = await Store.findOne({
    businessId: business._id,
    isDefault: true,
    isActive: true,
  }).lean();
  if (!store) {
    throw new Error("Default store is missing after bootstrap.");
  }

  return {
    businessId: business._id as Types.ObjectId,
    storeId: store._id as Types.ObjectId,
  };
}

export async function findOwnerUser() {
  await connectToDatabase();
  return User.findOne({ role: "owner" }).sort({ createdAt: 1 });
}

export async function bootstrapOwnerAccount(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<OwnerBootstrapResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const name = (input.name?.trim() || "Store Owner").slice(0, 120);

  if (!email || !email.includes("@")) {
    throw new Error("OWNER_EMAIL must be a valid email address.");
  }
  if (!password || password.length < 8) {
    throw new Error("OWNER_PASSWORD must be at least 8 characters.");
  }

  const existingOwner = await findOwnerUser();
  if (existingOwner) {
    return {
      status: "exists",
      userId: String(existingOwner._id),
      email: existingOwner.email,
      message:
        "An owner account already exists. Password was not changed. Use npm run auth:reset-owner-password to rotate it.",
    };
  }

  const emailTaken = await User.findOne({ email }).select("_id role").lean();
  if (emailTaken) {
    throw new Error(
      `A user with email ${email} already exists (${emailTaken.role}). Refusing to create a second owner.`,
    );
  }

  const { businessId, storeId } = await ensureDefaultStoreScope();
  const passwordHash = await hashPassword(password);

  const owner = await User.create({
    name,
    email,
    passwordHash,
    role: "owner",
    phone: "",
    avatarUrl: "",
    isActive: true,
    businessId,
    defaultStoreId: storeId,
    mustChangePassword: false,
    lastPasswordChangeAt: new Date(),
    sessionVersion: 0,
  });

  return {
    status: "created",
    userId: String(owner._id),
    email: owner.email,
    businessId: String(businessId),
    storeId: String(storeId),
  };
}

export async function resetOwnerPassword(input: {
  email?: string;
  password: string;
}) {
  const password = input.password;
  if (!password || password.length < 8) {
    throw new Error("OWNER_PASSWORD must be at least 8 characters.");
  }

  await connectToDatabase();
  const owner = input.email
    ? await User.findOne({
        email: input.email.trim().toLowerCase(),
        role: "owner",
      })
    : await findOwnerUser();

  if (!owner) {
    throw new Error(
      "No owner account found. Run npm run auth:bootstrap-owner first.",
    );
  }

  owner.passwordHash = await hashPassword(password);
  owner.mustChangePassword = false;
  owner.lastPasswordChangeAt = new Date();
  owner.sessionVersion = (owner.sessionVersion ?? 0) + 1;
  await owner.save();

  return {
    userId: String(owner._id),
    email: owner.email,
    sessionVersion: owner.sessionVersion,
  };
}
