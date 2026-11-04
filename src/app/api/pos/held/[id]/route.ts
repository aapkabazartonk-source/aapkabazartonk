import { handleApiError, isValidObjectId, jsonError, jsonOk } from "@/lib/api";
import { discardHeldCart } from "@/lib/billing-service";
import { scopeFromTenant } from "@/lib/inventory-stock";
import { requireTenant } from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;
    if (!isValidObjectId(id)) return jsonError("Invalid held bill.", 400);
    const data = await discardHeldCart(scopeFromTenant(tenant), id);
    return jsonOk({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
