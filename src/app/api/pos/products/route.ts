import { escapeRegex, handleApiError, isValidObjectId, jsonError, jsonOk } from "@/lib/api";
import { requireTenant } from "@/lib/tenant";
import { stateName } from "@/lib/india-states";
import { Business } from "@/models/Business";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";
import { Store } from "@/models/Store";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();
    const barcode = (searchParams.get("barcode") || "").trim();
    const categoryId = (searchParams.get("category") || "").trim();
    const limit = Math.min(80, Math.max(1, Number(searchParams.get("limit") || 60) || 60));

    const filter: Record<string, unknown> = {
      businessId: tenant.businessId,
      isActive: true,
    };
    const and: Record<string, unknown>[] = [];

    if (barcode) {
      and.push({
        $or: [{ barcode }, { sku: barcode.toUpperCase() }],
      });
    } else if (search) {
      const pattern = escapeRegex(search);
      and.push({
        $or: [
          { name: { $regex: pattern, $options: "i" } },
          { sku: { $regex: pattern, $options: "i" } },
          { barcode: { $regex: pattern, $options: "i" } },
        ],
      });
    }

    if (categoryId) {
      if (!isValidObjectId(categoryId)) {
        return jsonError("Invalid category filter.", 400);
      }
      and.push({
        $or: [{ category: categoryId }, { subcategory: categoryId }],
      });
    }

    if (and.length > 0) filter.$and = and;

    const [products, categories, business, store] = await Promise.all([
      Product.find(filter)
        .sort({ name: 1 })
        .limit(limit)
        .select("name sku barcode sellingPrice currentStock unit hsn gstRate category")
        .populate("category", "name")
        .lean(),
      Category.find({
        businessId: tenant.businessId,
        isActive: true,
        parentCategory: null,
      })
        .sort({ name: 1 })
        .select("name")
        .lean(),
      Business.findById(tenant.businessId)
        .select(
          "name legalName gstin isGstRegistered pricesIncludeGst state stateCode phone address city pincode",
        )
        .lean(),
      Store.findById(tenant.storeId).select("name code phone address city state pincode").lean(),
    ]);

    return jsonOk({
      data: products,
      categories,
      business: {
        name: business?.name ?? "",
        legalName: business?.legalName ?? "",
        gstin: business?.gstin ?? "",
        isGstRegistered: Boolean(business?.isGstRegistered),
        pricesIncludeGst: Boolean(business?.pricesIncludeGst),
        stateCode: business?.stateCode ?? "",
        stateName: business?.state || stateName(business?.stateCode),
        phone: store?.phone || business?.phone || "",
        storeName: store?.name ?? "",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
