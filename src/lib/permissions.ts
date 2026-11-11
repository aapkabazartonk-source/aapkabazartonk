import type { SettingsPermission, UserRole } from "@/lib/constants";

/**
 * Role → permission matrix.
 * Auth is not fully integrated yet; when userId is null the bootstrap tenant
 * is treated as owner so existing single-store workflows keep working.
 * Migration: once sessions exist, set User.role and pass it through TenantContext.
 */
const ROLE_PERMISSIONS: Record<UserRole, readonly SettingsPermission[]> = {
  owner: [
    "products.manage",
    "inventory.adjust",
    "purchases.manage",
    "pos.bill",
    "pos.discount_override",
    "sales.cancel",
    "reports.view",
    "settings.manage",
    "users.manage",
  ],
  admin: [
    "products.manage",
    "inventory.adjust",
    "purchases.manage",
    "pos.bill",
    "pos.discount_override",
    "sales.cancel",
    "reports.view",
    "settings.manage",
    "users.manage",
  ],
  manager: [
    "products.manage",
    "inventory.adjust",
    "purchases.manage",
    "pos.bill",
    "pos.discount_override",
    "sales.cancel",
    "reports.view",
    "settings.manage",
  ],
  cashier: ["pos.bill"],
  viewer: ["pos.bill"],
};

export class PermissionError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "PermissionError";
    this.status = status;
  }
}

export function normalizeRole(role: string | null | undefined): UserRole {
  if (role === "admin") return "admin";
  if (role === "manager") return "manager";
  if (role === "cashier") return "cashier";
  if (role === "viewer") return "viewer";
  return "owner";
}

export function roleHasPermission(
  role: UserRole | null | undefined,
  permission: SettingsPermission,
) {
  const normalized = normalizeRole(role ?? "owner");
  return ROLE_PERMISSIONS[normalized].includes(permission);
}

export function assertPermission(
  role: UserRole | null | undefined,
  permission: SettingsPermission,
  message = "You do not have permission to perform this action.",
) {
  if (!roleHasPermission(role, permission)) {
    throw new PermissionError(message, 403);
  }
}

export function permissionsForRole(role: UserRole | null | undefined) {
  return [...ROLE_PERMISSIONS[normalizeRole(role ?? "owner")]];
}
