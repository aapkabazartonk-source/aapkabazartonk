import { connectToDatabase } from "@/lib/db";
import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
} from "@/lib/api";
import { cancelPurchase } from "@/lib/purchase-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    await connectToDatabase();
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return jsonError("Invalid purchase ID.", 400);
    }

    const purchase = await cancelPurchase(id);

    return jsonOk({
      data: purchase.toObject(),
      message: "Purchase cancelled. Stock was not modified.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
