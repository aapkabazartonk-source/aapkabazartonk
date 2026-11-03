import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
  parsePagination,
} from "@/lib/api";
import {
  createStockAdjustment,
  scopeFromTenant,
} from "@/lib/inventory-stock";
import { requireTenant } from "@/lib/tenant";
import { stockAdjustmentCreateSchema } from "@/lib/validators/inventory";
import { StockAdjustment } from "@/models/StockAdjustment";
import { User } from "@/models/User";

// Ensure User is registered for createdBy populate
void User;

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const productId = searchParams.get("productId");
    const adjustmentType = searchParams.get("adjustmentType");

    const filter: Record<string, unknown> = {
      businessId: tenant.businessId,
    };
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
    const tenant = await requireTenant(request);
    const body = await request.json();
    const parsed = stockAdjustmentCreateSchema.parse(body);

    if (!isValidObjectId(parsed.productId)) {
      return jsonError("Invalid product ID.", 400);
    }

    const headerKey = request.headers.get("Idempotency-Key")?.trim();
    const result = await createStockAdjustment({
      scope: scopeFromTenant(tenant),
      productId: parsed.productId,
      adjustmentType: parsed.adjustmentType,
      quantity: parsed.quantity,
      reason: parsed.reason,
      notes: parsed.notes,
      referenceNumber: parsed.referenceNumber,
      idempotencyKey: headerKey || parsed.idempotencyKey,
    });

    const populated = await StockAdjustment.findOne({
      _id: result.adjustment._id,
      businessId: tenant.businessId,
    })
      .populate("product", "name sku currentStock minStockLevel")
      .populate("createdBy", "name email")
      .lean();

    return jsonOk({ data: populated, replayed: result.replayed }, result.replayed ? 200 : 201);
  } catch (error) {
    return handleApiError(error);
  }
}
