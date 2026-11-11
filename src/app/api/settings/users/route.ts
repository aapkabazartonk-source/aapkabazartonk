import { jsonError } from "@/lib/api";

/**
 * Staff and role management APIs are intentionally disabled.
 * Aapka Bazar supports a single store owner account only.
 */
export async function GET() {
  return jsonError(
    "Staff management is not available. This store uses a single owner account.",
    404,
  );
}

export async function POST() {
  return jsonError(
    "Staff management is not available. This store uses a single owner account.",
    404,
  );
}

export async function PATCH() {
  return jsonError(
    "Staff management is not available. This store uses a single owner account.",
    404,
  );
}
