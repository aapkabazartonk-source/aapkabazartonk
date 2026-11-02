import { connectToDatabase } from "@/lib/db";
import { getAuthContext } from "@/lib/auth";
import {
  handleApiError,
  jsonOk,
  parsePagination,
} from "@/lib/api";
import { createPurchaseDraft } from "@/lib/purchase-service";
import { PURCHASE_STATUSES } from "@/lib/constants";
import { purchaseCreateSchema } from "@/lib/validators/purchase";
import { Purchase } from "@/models/Purchase";

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const search = (searchParams.get("search") || "").trim();
    const status = searchParams.get("status");

    const filter: Record<string, unknown> = {};
    if (
      status &&
      PURCHASE_STATUSES.includes(status as (typeof PURCHASE_STATUSES)[number])
    ) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { purchaseNumber: { $regex: search, $options: "i" } },
        { supplierName: { $regex: search, $options: "i" } },
        { "items.productName": { $regex: search, $options: "i" } },
        { "items.sku": { $regex: search, $options: "i" } },
      ];
    }

    const [total, purchases, draftCount, receivedCount, cancelledCount] =
      await Promise.all([
        Purchase.countDocuments(filter),
        Purchase.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Purchase.countDocuments({ status: "DRAFT" }),
        Purchase.countDocuments({ status: "RECEIVED" }),
        Purchase.countDocuments({ status: "CANCELLED" }),
      ]);

    return jsonOk({
      data: purchases,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: {
        draftCount,
        receivedCount,
        cancelledCount,
        totalPurchases: draftCount + receivedCount + cancelledCount,
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
    const parsed = purchaseCreateSchema.parse(body);

    const purchase = await createPurchaseDraft({
      data: parsed,
      createdBy: auth.userId,
    });

    return jsonOk({ data: purchase.toObject() }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
