import { connectToDatabase } from "@/lib/db";
import { handleApiError, jsonOk } from "@/lib/api";
import { getStockStatus } from "@/lib/product-rules";
import { InventoryLog } from "@/models/InventoryLog";
import { Product } from "@/models/Product";

function parseDateRange(searchParams: URLSearchParams) {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const range: { createdAt?: { $gte?: Date; $lte?: Date } } = {};

  if (from || to) {
    range.createdAt = {};
    if (from) range.createdAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      range.createdAt.$lte = end;
    }
  }

  return range;
}

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const dateFilter = parseDateRange(searchParams);

    const [
      totalProducts,
      stockUnitsAgg,
      inventoryValueAgg,
      inStockProducts,
      lowStockProducts,
      outOfStockProducts,
      stockMovementTrend,
      stockByCategory,
      valuationByCategory,
      lowStockAlerts,
      outOfStockList,
      recentMovements,
      recentlyUpdated,
    ] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Product.aggregate<{ total: number }>([
        { $match: { isActive: true } },
        { $group: { _id: null, total: { $sum: "$currentStock" } } },
      ]),
      Product.aggregate<{ value: number }>([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            value: {
              $sum: { $multiply: ["$currentStock", "$purchasePrice"] },
            },
          },
        },
      ]),
      Product.countDocuments({
        isActive: true,
        $expr: { $gt: ["$currentStock", "$minStockLevel"] },
      }),
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
      InventoryLog.aggregate<{
        _id: string;
        stockIn: number;
        stockOut: number;
      }>([
        ...(dateFilter.createdAt ? [{ $match: dateFilter }] : []),
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            stockIn: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$movementType",
                      ["STOCK_IN", "OPENING_STOCK", "PURCHASE_RECEIVE"],
                    ],
                  },
                  "$quantity",
                  0,
                ],
              },
            },
            stockOut: {
              $sum: {
                $cond: [
                  {
                    $in: ["$movementType", ["STOCK_OUT", "DAMAGED", "LOST"]],
                  },
                  "$quantity",
                  {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$movementType", "CORRECTION"] },
                          { $lt: ["$newStock", "$previousStock"] },
                        ],
                      },
                      "$quantity",
                      0,
                    ],
                  },
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 30 },
      ]),
      Product.aggregate<{ _id: unknown; name: string; units: number }>([
        { $match: { isActive: true } },
        {
          $group: {
            _id: "$category",
            units: { $sum: "$currentStock" },
          },
        },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "category",
          },
        },
        {
          $project: {
            name: {
              $ifNull: [{ $arrayElemAt: ["$category.name", 0] }, "Uncategorized"],
            },
            units: 1,
          },
        },
        { $sort: { units: -1 } },
        { $limit: 8 },
      ]),
      Product.aggregate<{ _id: unknown; name: string; value: number }>([
        { $match: { isActive: true } },
        {
          $group: {
            _id: "$category",
            value: {
              $sum: { $multiply: ["$currentStock", "$purchasePrice"] },
            },
          },
        },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "category",
          },
        },
        {
          $project: {
            name: {
              $ifNull: [{ $arrayElemAt: ["$category.name", 0] }, "Uncategorized"],
            },
            value: 1,
          },
        },
        { $sort: { value: -1 } },
        { $limit: 8 },
      ]),
      Product.find({
        isActive: true,
        $expr: {
          $and: [
            { $gt: ["$currentStock", 0] },
            { $lte: ["$currentStock", "$minStockLevel"] },
          ],
        },
      })
        .populate("category", "name")
        .sort({ currentStock: 1 })
        .limit(8)
        .lean(),
      Product.find({ isActive: true, currentStock: { $lte: 0 } })
        .populate("category", "name")
        .sort({ updatedAt: -1 })
        .limit(8)
        .lean(),
      InventoryLog.find(dateFilter.createdAt ? dateFilter : {})
        .populate("product", "name sku")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Product.find({ isActive: true })
        .populate("category", "name")
        .sort({ updatedAt: -1 })
        .limit(8)
        .select("name sku currentStock minStockLevel updatedAt images category")
        .lean(),
    ]);

    const chartColors = ["#A3CA69", "#9299C9", "#C5DF8F", "#B8BFD9", "#7EAB3A", "#6B739E", "#DCE0F0", "#E5F0D5"];

    return jsonOk({
      data: {
        stats: {
          totalProducts,
          totalStockUnits: stockUnitsAgg[0]?.total ?? 0,
          totalInventoryValue: inventoryValueAgg[0]?.value ?? 0,
          inStockProducts,
          lowStockProducts,
          outOfStockProducts,
        },
        charts: {
          stockMovementTrend: stockMovementTrend.map((row) => ({
            date: row._id,
            stockIn: row.stockIn,
            stockOut: row.stockOut,
          })),
          stockByCategory: stockByCategory.map((row, index) => ({
            name: row.name,
            value: row.units,
            fill: chartColors[index % chartColors.length],
          })),
          valuationByCategory: valuationByCategory.map((row, index) => ({
            name: row.name,
            value: Math.round((row.value + Number.EPSILON) * 100) / 100,
            fill: chartColors[index % chartColors.length],
          })),
        },
        lowStockAlerts: lowStockAlerts.map((product) => {
          const currentStock = Number(product.currentStock ?? 0);
          const minStockLevel = Number(product.minStockLevel ?? 0);
          return {
            ...product,
            stockStatus: getStockStatus(currentStock, minStockLevel),
            suggestedReorder: Math.max(minStockLevel * 2 - currentStock, minStockLevel),
          };
        }),
        outOfStockProducts: outOfStockList.map((product) => {
          const currentStock = Number(product.currentStock ?? 0);
          const minStockLevel = Number(product.minStockLevel ?? 0);
          return {
            ...product,
            stockStatus: getStockStatus(currentStock, minStockLevel),
            suggestedReorder: Math.max(minStockLevel * 2, 1),
          };
        }),
        recentMovements,
        recentlyUpdated,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
