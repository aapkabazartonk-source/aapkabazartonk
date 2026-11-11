import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, describe, it } from "node:test";

function loadEnv() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnv();

describe("owner authentication", { concurrency: 1 }, () => {
  after(async () => {
    const mongoose = await import("mongoose");
    await mongoose.disconnect();
  });

  it("enforces single-owner bootstrap and authenticated tenant access", async () => {
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
      process.env.SESSION_SECRET =
        "test-session-secret-at-least-32-characters-long";
    }

    const { connectToDatabase } = await import("../src/lib/db.ts");
    await connectToDatabase();

    const { bootstrapOwnerAccount, findOwnerUser, resetOwnerPassword } =
      await import("../src/lib/owner.ts");
    const { requireTenant, TenantError, resolveTenantContext } =
      await import("../src/lib/tenant.ts");
    const { encryptSession, decryptSession } =
      await import("../src/lib/session-crypto.ts");
    const { verifyPassword } = await import("../src/lib/password.ts");
    const { User } = await import("../src/models/User.ts");

    const stamp = Date.now().toString(36);
    const email = `owner-auth-${stamp}@example.com`;
    const password = `Pass-${stamp}-Ok1`;

    const priorOwner = await findOwnerUser();
    let createdInThisTest = false;

    if (!priorOwner) {
      const created = await bootstrapOwnerAccount({
        email,
        password,
        name: "Auth Test Owner",
      });
      assert.equal(created.status, "created");
      createdInThisTest = true;
    }

    const owner = await findOwnerUser();
    assert.ok(owner);

    const duplicate = await bootstrapOwnerAccount({
      email: `another-${stamp}@example.com`,
      password: "another-password-123",
    });
    assert.equal(duplicate.status, "exists");
    assert.equal(duplicate.userId, String(owner._id));

    await assert.rejects(
      () => requireTenant(),
      (error: unknown) =>
        error instanceof TenantError && error.status === 401,
    );

    const tenant = await resolveTenantContext({
      userId: String(owner._id),
      sessionVersion: owner.sessionVersion ?? 0,
    });
    assert.equal(tenant.authIntegrated, true);
    assert.equal(String(tenant.businessId), String(owner.businessId));

    const token = await encryptSession(
      {
        userId: String(owner._id),
        sessionVersion: owner.sessionVersion ?? 0,
        rememberMe: true,
      },
      3600,
    );
    const session = await decryptSession(token);
    assert.equal(session?.userId, String(owner._id));
    assert.equal(session?.rememberMe, true);

    // Only rotate the password when this test created the owner account.
    if (createdInThisTest) {
      const reset = await resetOwnerPassword({
        email: owner.email,
        password: `Reset-${stamp}-Ok1`,
      });
      assert.equal(reset.email, owner.email);

      const refreshed = await User.findById(owner._id);
      assert.ok(refreshed);
      assert.equal(
        await verifyPassword(`Reset-${stamp}-Ok1`, refreshed.passwordHash),
        true,
      );
      assert.ok((refreshed.sessionVersion ?? 0) > (owner.sessionVersion ?? 0));

      await assert.rejects(
        () =>
          resolveTenantContext({
            userId: String(owner._id),
            sessionVersion: owner.sessionVersion ?? 0,
          }),
        (error: unknown) =>
          error instanceof TenantError && error.status === 401,
      );

      await User.deleteOne({ _id: owner._id });
    }
  });
});
