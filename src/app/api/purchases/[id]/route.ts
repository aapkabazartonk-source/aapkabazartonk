import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
} from "@/lib/api";
import { scopeFromTenant } from "@/lib/inventory-stock";
import { updatePurchaseDraft } from "@/lib/purchase-service";
import { requireTenant } from "@/lib/tenant";
import { purchaseUpdateSchema } from "@/lib/validators/purchase";
import { Purchase } from "@/models/Purchase";
import { Supplier } from "@/models/Supplier";
import { User } from "@/models/User";

void User;
void Supplier;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return jsonError("Invalid purchase ID.", 400);
    }

    const purchase = await Purchase.findOne({
      _id: id,
      businessId: tenant.businessId,
    })
      .populate("createdBy", "name email")
      .populate("supplier", "name phone email")
      .lean();

    if (!purchase) {
      return jsonError("Purchase not found.", 404);
    }

    return jsonOk({ data: purchase });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return jsonError("Invalid purchase ID.", 400);
    }

    const body = await request.json();
    const parsed = purchaseUpdateSchema.parse(body);
    const purchase = await updatePurchaseDraft(
      id,
      parsed,
      scopeFromTenant(tenant),
    );

    return jsonOk({ data: purchase.toObject() });
  } catch (error) {
    return handleApiError(error);
  }
}
