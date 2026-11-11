/**
 * First-time store owner bootstrap.
 *
 * Usage:
 *   OWNER_EMAIL=you@store.com OWNER_PASSWORD='strong-password' npm run auth:bootstrap-owner
 *
 * Never overwrites an existing owner password.
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
loadEnvFile(".env");

async function main() {
  const email = process.env.OWNER_EMAIL?.trim();
  const password = process.env.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME?.trim();

  if (!email || !password) {
    console.error(
      "Set OWNER_EMAIL and OWNER_PASSWORD (optional OWNER_NAME) before running.",
    );
    process.exit(1);
  }

  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is required.");
    process.exit(1);
  }

  const { bootstrapOwnerAccount } = await import("../src/lib/owner");
  const result = await bootstrapOwnerAccount({ email, password, name });

  if (result.status === "exists") {
    console.log(result.message);
    console.log(`Existing owner: ${result.email} (${result.userId})`);
    process.exit(0);
  }

  console.log("Owner account created.");
  console.log(`Email: ${result.email}`);
  console.log(`User id: ${result.userId}`);
  console.log(`Business id: ${result.businessId}`);
  console.log(`Store id: ${result.storeId}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
