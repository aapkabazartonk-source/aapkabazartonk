import {
  escapeRegex,
  handleApiError,
  jsonOk,
  parsePagination,
} from "@/lib/api";
import { scopeFromTenant } from "@/lib/inventory-stock";
import { createPurchaseDraft } from "@/lib/purchase-service";
import { requireTenant } from "@/lib/tenant";
import { PURCHASE_STATUSES } from "@/lib/constants";
import { purchaseCreateSchema } from "@/lib/validators/purchase";
import { Purchase } from "@/models/Purchase";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const search = (searchParams.get("search") || "").trim();
    const status = searchParams.get("status");

    const filter: Record<string, unknown> = {
      businessId: tenant.businessId,
    };
    const safeSearch = escapeRegex(search);
    if (
      status &&
      PURCHASE_STATUSES.includes(status as (typeof PURCHASE_STATUSES)[number])
    ) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { purchaseNumber: { $regex: safeSearch, $options: "i" } },
        { supplierName: { $regex: safeSearch, $options: "i" } },
        { supplierInvoiceNumber: { $regex: safeSearch, $options: "i" } },
        { "items.productName": { $regex: safeSearch, $options: "i" } },
        { "items.productNameSnapshot": { $regex: safeSearch, $options: "i" } },
        { "items.sku": { $regex: safeSearch, $options: "i" } },
        { "items.skuSnapshot": { $regex: safeSearch, $options: "i" } },
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
        Purchase.countDocuments({
          businessId: tenant.businessId,
          status: "DRAFT",
        }),
        Purchase.countDocuments({
          businessId: tenant.businessId,
          status: "RECEIVED",
        }),
        Purchase.countDocuments({
          businessId: tenant.businessId,
          status: "CANCELLED",
        }),
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
    const tenant = await requireTenant(request);
    const body = await request.json();
    const parsed = purchaseCreateSchema.parse(body);

    const purchase = await createPurchaseDraft({
      data: parsed,
      scope: scopeFromTenant(tenant),
    });

    return jsonOk({ data: purchase.toObject() }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
