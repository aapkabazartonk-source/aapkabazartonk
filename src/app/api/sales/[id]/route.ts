import { handleApiError, isValidObjectId, jsonError, jsonOk } from "@/lib/api";
import { getSaleBundle } from "@/lib/billing-service";
import { requireTenant } from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;
    if (!isValidObjectId(id)) return jsonError("Invalid sale.", 400);
    const bundle = await getSaleBundle(tenant.businessId, id);
    if (!bundle) return jsonError("Sale not found.", 404);
    return jsonOk({ data: bundle });
  } catch (error) {
    return handleApiError(error);
  }
}
