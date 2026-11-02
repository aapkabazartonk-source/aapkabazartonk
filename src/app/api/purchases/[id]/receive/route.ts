import { connectToDatabase } from "@/lib/db";
import { getAuthContext } from "@/lib/auth";
import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
} from "@/lib/api";
import { receivePurchase } from "@/lib/purchase-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    await connectToDatabase();
    const auth = await getAuthContext(request);
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return jsonError("Invalid purchase ID.", 400);
    }

    const purchase = await receivePurchase({
      purchaseId: id,
      performedBy: auth.userId,
    });

    return jsonOk({
      data: purchase.toObject(),
      message: "Purchase received and stock updated.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
