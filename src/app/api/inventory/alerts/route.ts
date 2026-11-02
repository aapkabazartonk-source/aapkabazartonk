import { connectToDatabase } from "@/lib/db";
import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
  parsePagination,
} from "@/lib/api";
import { getStockStatus } from "@/lib/product-rules";
import { Product } from "@/models/Product";

export async function GET(request: Request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const search = (searchParams.get("search") || "").trim();
    const status = searchParams.get("status"); // low_stock | out_of_stock | all
    const categoryId = searchParams.get("category");

    const filter: Record<string, unknown> = { isActive: true };

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
          ],
        },
      ];
    }

    if (status === "out_of_stock") {
      filter.currentStock = { $lte: 0 };
    } else if (status === "low_stock") {
      filter.$expr = {
        $and: [
          { $gt: ["$currentStock", 0] },
          { $lte: ["$currentStock", "$minStockLevel"] },
        ],
      };
    } else {
      // Default: low + out
      filter.$expr = {
        $lte: ["$currentStock", "$minStockLevel"],
      };
    }

    const [total, products, lowCount, outCount] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate("category", "name slug")
        .populate("subcategory", "name slug")
        .sort({ currentStock: 1, name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments({
        isActive: true,
        $expr: {
          $and: [
            { $gt: ["$currentStock", 0] },
            { $lte: ["$currentStock", "$minStockLevel"] },
          ],
        },
      }),
      Product.countDocuments({ isActive: true, currentStock: { $lte: 0 } }),
    ]);

    return jsonOk({
      data: products.map((product) => {
        const currentStock = Number(product.currentStock ?? 0);
        const minStockLevel = Number(product.minStockLevel ?? 0);
        const stockStatus = getStockStatus(currentStock, minStockLevel);
        const suggestedReorder =
          stockStatus === "out_of_stock"
            ? Math.max(minStockLevel * 2, 1)
            : Math.max(minStockLevel * 2 - currentStock, minStockLevel);

        return {
          ...product,
          stockStatus,
          suggestedReorder,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: {
        lowStockProducts: lowCount,
        outOfStockProducts: outCount,
        totalAlerts: lowCount + outCount,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
