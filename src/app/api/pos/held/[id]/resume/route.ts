import { handleApiError, isValidObjectId, jsonError, jsonOk } from "@/lib/api";
import { resumeHeldCart } from "@/lib/billing-service";
import { scopeFromTenant } from "@/lib/inventory-stock";
import { requireTenant } from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;
    if (!isValidObjectId(id)) return jsonError("Invalid held bill.", 400);
    const data = await resumeHeldCart(scopeFromTenant(tenant), id);
    return jsonOk({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
