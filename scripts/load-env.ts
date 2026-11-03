import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");

for (const line of text.split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (!match) continue;
  const key = match[1].trim();
  const value = match[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[key]) process.env[key] = value;
}
