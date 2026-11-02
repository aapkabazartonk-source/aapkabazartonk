import { connectToDatabase } from "@/lib/db";
import { getAuthContext } from "@/lib/auth";
import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
  parsePagination,
} from "@/lib/api";
import { createStockAdjustment } from "@/lib/inventory-stock";
import { stockAdjustmentCreateSchema } from "@/lib/validators/inventory";
import { StockAdjustment } from "@/models/StockAdjustment";
import { User } from "@/models/User";

// Ensure User is registered for createdBy populate
void User;

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const productId = searchParams.get("productId");
    const adjustmentType = searchParams.get("adjustmentType");

    const filter: Record<string, unknown> = {};
    if (productId) {
      if (!isValidObjectId(productId)) {
        return jsonError("Invalid product ID.", 400);
      }
      filter.product = productId;
    }
    if (adjustmentType) filter.adjustmentType = adjustmentType;

    const [total, adjustments] = await Promise.all([
      StockAdjustment.countDocuments(filter),
      StockAdjustment.find(filter)
        .populate("product", "name sku currentStock")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return jsonOk({
      data: adjustments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const auth = await getAuthContext(request);
    const body = await request.json();
    const parsed = stockAdjustmentCreateSchema.parse(body);

    if (!isValidObjectId(parsed.productId)) {
      return jsonError("Invalid product ID.", 400);
    }

    const adjustment = await createStockAdjustment({
      productId: parsed.productId,
      adjustmentType: parsed.adjustmentType,
      quantity: parsed.quantity,
      reason: parsed.reason,
      notes: parsed.notes,
      referenceNumber: parsed.referenceNumber,
      createdBy: auth.userId,
    });

    const populated = await StockAdjustment.findById(adjustment._id)
      .populate("product", "name sku currentStock minStockLevel")
      .populate("createdBy", "name email")
      .lean();

    return jsonOk({ data: populated }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
