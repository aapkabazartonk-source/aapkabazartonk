import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
  parsePagination,
} from "@/lib/api";
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
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const search = (searchParams.get("search") || "").trim();
    const status = searchParams.get("status"); // active | inactive
    const stockStatus = searchParams.get("stockStatus"); // in_stock | low_stock | out_of_stock
    const categoryId = searchParams.get("category");
    const sort = searchParams.get("sort") || "createdAt";
    const order = searchParams.get("order") === "asc" ? 1 : -1;

    const filter: Record<string, unknown> = {};

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
            { name: { $regex: search, $options: "i" } },
            { sku: { $regex: search, $options: "i" } },
            { barcode: { $regex: search, $options: "i" } },
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
      Product.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({
        $expr: {
          $and: [
            { $gt: ["$currentStock", 0] },
            { $lte: ["$currentStock", "$minStockLevel"] },
          ],
        },
      }),
      Product.aggregate<{ value: number }>([
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
    await connectToDatabase();

    const body = await request.json();
    const parsed = productCreateSchema.parse(body);

    if (!isValidObjectId(parsed.category)) {
      return jsonError("Invalid category.", 400);
    }

    await assertValidCategoryRefs(parsed.category, parsed.subcategory, {
      requireActive: true,
    });
    await assertUniqueSku(parsed.sku);
    await assertUniqueBarcode(parsed.barcode);

    const images = (parsed.images ?? []).filter((url) => url.trim().length > 0);

    const product = await Product.create({
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
      currentStock: parsed.currentStock,
      minStockLevel: parsed.minStockLevel ?? 5,
      unit: parsed.unit,
      images,
      isActive: parsed.isActive ?? true,
    });

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
