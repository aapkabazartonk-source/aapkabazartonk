/**
 * Secure owner password reset (no email provider configured).
 *
 * Usage:
 *   OWNER_EMAIL=you@store.com OWNER_PASSWORD='new-strong-password' npm run auth:reset-owner-password
 *
 * OWNER_EMAIL is optional when only one owner exists.
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

  if (!password) {
    console.error("Set OWNER_PASSWORD (and optionally OWNER_EMAIL) before running.");
    process.exit(1);
  }

  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is required.");
    process.exit(1);
  }

  const { resetOwnerPassword } = await import("../src/lib/owner");
  const result = await resetOwnerPassword({ email, password });

  console.log("Owner password updated. Existing sessions are invalidated.");
  console.log(`Email: ${result.email}`);
  console.log(`User id: ${result.userId}`);
  console.log(`Session version: ${result.sessionVersion}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
