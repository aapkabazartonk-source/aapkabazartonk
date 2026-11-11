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

const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const email = process.env.OWNER_EMAIL;
const password = process.env.OWNER_PASSWORD;

if (!email || !password) {
  console.error("OWNER_EMAIL and OWNER_PASSWORD required");
  process.exit(1);
}

async function main() {
  const bad = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "wrong-password-value" }),
  });
  console.log("invalid login", bad.status, await bad.json());

  const unauth = await fetch(`${base}/api/products`);
  console.log("unauth products", unauth.status, await unauth.json());

  const ok = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, rememberMe: true }),
  });
  const setCookie = ok.headers.getSetCookie?.() || [];
  console.log("valid login", ok.status, await ok.json());
  console.log(
    "cookie httpOnly",
    setCookie.some((value) => /ab_session=/.test(value) && /HttpOnly/i.test(value)),
  );

  const cookie = setCookie
    .map((value) => value.split(";")[0])
    .find((value) => value.startsWith("ab_session="));

  const products = await fetch(`${base}/api/products`, {
    headers: cookie ? { cookie } : {},
  });
  console.log("auth products", products.status);

  const logout = await fetch(`${base}/api/auth/logout`, {
    method: "POST",
    headers: cookie ? { cookie } : {},
  });
  console.log("logout", logout.status);

  const after = await fetch(`${base}/api/products`, {
    headers: cookie ? { cookie } : {},
  });
  console.log("after logout products", after.status);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
