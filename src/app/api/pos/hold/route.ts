import { handleApiError, jsonOk } from "@/lib/api";
import { holdCart } from "@/lib/billing-service";
import { scopeFromTenant } from "@/lib/inventory-stock";
import { requireTenant } from "@/lib/tenant";
import { holdCartSchema } from "@/lib/validators/billing";

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const body = await request.json();
    const parsed = holdCartSchema.parse(body);
    const held = await holdCart({
      data: parsed,
      scope: scopeFromTenant(tenant),
    });
    return jsonOk({ data: held }, parsed.heldCartId ? 200 : 201);
  } catch (error) {
    return handleApiError(error);
  }
}
