import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
} from "@/lib/api";
import { scopeFromTenant } from "@/lib/inventory-stock";
import { receivePurchase } from "@/lib/purchase-service";
import { requireTenant } from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return jsonError("Invalid purchase ID.", 400);
    }

    const purchase = await receivePurchase({
      purchaseId: id,
      scope: scopeFromTenant(tenant),
    });

    return jsonOk({
      data: purchase.toObject(),
      message: "Purchase received and stock updated.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
