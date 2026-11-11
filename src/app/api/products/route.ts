import { Types } from "mongoose";
import {
  escapeRegex,
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
  parsePagination,
} from "@/lib/api";
import {
  createProductWithOpeningStock,
  scopeFromTenant,
} from "@/lib/inventory-stock";
import { requireTenant } from "@/lib/tenant";
import {
  assertUniqueBarcode,
  assertUniqueSku,
  assertValidCategoryRefs,
  getStockStatus,
} from "@/lib/product-rules";
import { productCreateSchema } from "@/lib/validators/product";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";

function serializeProduct(product: Record<string, unknown>) {
  const currentStock = Number(product.currentStock ?? 0);
  const minStockLevel = Number(product.minStockLevel ?? 0);
  return {
    ...product,
    stockStatus: getStockStatus(currentStock, minStockLevel),
  };
}

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const search = (searchParams.get("search") || "").trim();
    const status = searchParams.get("status"); // active | inactive
    const stockStatus = searchParams.get("stockStatus"); // in_stock | low_stock | out_of_stock
    const categoryId = searchParams.get("category");
    const sort = searchParams.get("sort") || "createdAt";
    const order = searchParams.get("order") === "asc" ? 1 : -1;

    const filter: Record<string, unknown> = {
      businessId: tenant.businessId,
    };

    if (status === "active") filter.isActive = true;
    if (status === "inactive") filter.isActive = false;

    if (categoryId) {
      if (!isValidObjectId(categoryId)) {
        return jsonError("Invalid category filter.", 400);
      }
      filter.$or = [{ category: categoryId }, { subcategory: categoryId }];
    }

    if (search) {
      filter.$and = [
        ...(Array.isArray(filter.$and) ? (filter.$and as object[]) : []),
        {
          $or: [
            { name: { $regex: escapeRegex(search), $options: "i" } },
            { sku: { $regex: escapeRegex(search), $options: "i" } },
            { barcode: { $regex: escapeRegex(search), $options: "i" } },
          ],
        },
      ];
    }

    if (stockStatus === "out_of_stock") {
      filter.currentStock = { $lte: 0 };
    } else if (stockStatus === "low_stock") {
      filter.$expr = {
        $and: [
          { $gt: ["$currentStock", 0] },
          { $lte: ["$currentStock", "$minStockLevel"] },
        ],
      };
    } else if (stockStatus === "in_stock") {
      filter.$expr = {
        $gt: ["$currentStock", "$minStockLevel"],
      };
    }

    const allowedSort = new Set([
      "createdAt",
      "name",
      "sku",
      "sellingPrice",
      "purchasePrice",
      "currentStock",
    ]);
    const sortField = allowedSort.has(sort) ? sort : "createdAt";

    const [
      total,
      products,
      totalProducts,
      activeProducts,
      lowStockProducts,
      inventoryValueAgg,
    ] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate("category", "name slug isActive")
        .populate("subcategory", "name slug")
        .sort({ [sortField]: order })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments({ businessId: tenant.businessId }),
      Product.countDocuments({ businessId: tenant.businessId, isActive: true }),
      Product.countDocuments({
        businessId: tenant.businessId,
        isActive: true,
        $expr: {
          $and: [
            { $gt: ["$currentStock", 0] },
            { $lte: ["$currentStock", "$minStockLevel"] },
          ],
        },
      }),
      Product.aggregate<{ value: number }>([
        { $match: { businessId: tenant.businessId, isActive: true } },
        {
          $group: {
            _id: null,
            value: {
              $sum: { $multiply: ["$currentStock", "$purchasePrice"] },
            },
          },
        },
      ]),
    ]);

    return jsonOk({
      data: products.map((p) =>
        serializeProduct(p as unknown as Record<string, unknown>),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: {
        totalProducts,
        activeProducts,
        lowStockProducts,
        totalInventoryValue: inventoryValueAgg[0]?.value ?? 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const scope = scopeFromTenant(tenant);

    const body = await request.json();
    const parsed = productCreateSchema.parse(body);

    if (!isValidObjectId(parsed.category)) {
      return jsonError("Invalid category.", 400);
    }

    await assertValidCategoryRefs(parsed.category, parsed.subcategory, {
      requireActive: true,
      businessId: tenant.businessId,
    });
    await assertUniqueSku(parsed.sku, { businessId: tenant.businessId });
    await assertUniqueBarcode(parsed.barcode, {
      businessId: tenant.businessId,
    });

    const images = (parsed.images ?? []).filter((url) => url.trim().length > 0);

    const productData = {
      businessId: tenant.businessId,
      storeId: tenant.storeId,
      name: parsed.name.trim(),
      sku: parsed.sku,
      barcode: (parsed.barcode ?? "").trim(),
      description: parsed.description ?? "",
      category: new Types.ObjectId(parsed.category),
      subcategory: parsed.subcategory
        ? new Types.ObjectId(parsed.subcategory)
        : null,
      purchasePrice: parsed.purchasePrice,
      sellingPrice: parsed.sellingPrice,
      minStockLevel: parsed.minStockLevel ?? 5,
      unit: parsed.unit,
      hsn: (parsed.hsn ?? "").trim().toUpperCase(),
      gstRate: parsed.gstRate ?? 0,
      images,
      isActive: parsed.isActive ?? true,
    };

    let product;
    if (parsed.currentStock > 0) {
      product = await createProductWithOpeningStock({
        productData,
        openingStock: parsed.currentStock,
        scope,
      });
    } else {
      product = await Product.create({
        ...productData,
        currentStock: 0,
      });
    }

    const populated = await Product.findById(product._id)
      .populate("category", "name slug isActive")
      .populate("subcategory", "name slug")
      .lean();

    // Ensure Category model is registered for populate edge cases
    void Category;

    return jsonOk(
      {
        data: serializeProduct(
          populated as unknown as Record<string, unknown>,
        ),
      },
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
