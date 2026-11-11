/**
 * Updates the existing owner email/password to match .env.local.
 * Use when OWNER_EMAIL changed after the first bootstrap.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(fileName: string) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    if (process.env[key]) continue;
    process.env[key] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(".env.local");

async function main() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME?.trim();

  if (!email || !password) {
    console.error("OWNER_EMAIL and OWNER_PASSWORD are required in .env.local");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("OWNER_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const { connectToDatabase } = await import("../src/lib/db");
  await connectToDatabase();
  const { hashPassword } = await import("../src/lib/password");
  const { User } = await import("../src/models/User");

  const owner = await User.findOne({ role: "owner" }).sort({ createdAt: 1 });
  if (!owner) {
    console.error("No owner found. Run npm run auth:bootstrap-owner first.");
    process.exit(1);
  }

  const emailTaken = await User.findOne({
    email,
    _id: { $ne: owner._id },
  }).select("_id");
  if (emailTaken) {
    console.error(`Another user already uses ${email}.`);
    process.exit(1);
  }

  const previousEmail = owner.email;
  owner.email = email;
  if (name) owner.name = name.slice(0, 120);
  owner.passwordHash = await hashPassword(password);
  owner.mustChangePassword = false;
  owner.lastPasswordChangeAt = new Date();
  owner.sessionVersion = (owner.sessionVersion ?? 0) + 1;
  owner.isActive = true;
  await owner.save();

  console.log("Owner synced from .env.local");
  console.log(`Previous email: ${previousEmail}`);
  console.log(`New email: ${owner.email}`);
  console.log(`User id: ${owner._id}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
