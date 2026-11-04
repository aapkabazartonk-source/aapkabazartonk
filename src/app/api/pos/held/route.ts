import { handleApiError, jsonOk } from "@/lib/api";
import { listHeldCarts } from "@/lib/billing-service";
import { scopeFromTenant } from "@/lib/inventory-stock";
import { requireTenant } from "@/lib/tenant";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const data = await listHeldCarts(scopeFromTenant(tenant));
    return jsonOk({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
