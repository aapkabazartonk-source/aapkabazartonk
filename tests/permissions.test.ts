import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeRole,
  permissionsForRole,
  roleHasPermission,
} from "../src/lib/permissions.ts";

describe("permissions", () => {
  it("treats missing role as owner", () => {
    assert.equal(normalizeRole(undefined), "owner");
    assert.equal(roleHasPermission(null, "settings.manage"), true);
  });

  it("restricts cashier from settings and discount override", () => {
    assert.equal(roleHasPermission("cashier", "pos.bill"), true);
    assert.equal(roleHasPermission("cashier", "settings.manage"), false);
    assert.equal(roleHasPermission("cashier", "pos.discount_override"), false);
  });

  it("lists manager permissions", () => {
    const permissions = permissionsForRole("manager");
    assert.ok(permissions.includes("purchases.manage"));
    assert.ok(!permissions.includes("users.manage"));
  });
});
