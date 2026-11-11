import {
  STOCK_IN_MOVEMENT_TYPES,
  STOCK_OUT_MOVEMENT_TYPES,
} from "@/lib/constants";
import { handleApiError, jsonOk } from "@/lib/api";
import { getStockStatus } from "@/lib/product-rules";
import { suggestedReorderQuantity } from "@/lib/reorder";
import { requireTenant } from "@/lib/tenant";
import { InventoryLog } from "@/models/InventoryLog";
import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";
import { StockAdjustment } from "@/models/StockAdjustment";

function parseDateRange(searchParams: URLSearchParams) {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const createdAt: { $gte?: Date; $lte?: Date } = {};

  if (from) createdAt.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    createdAt.$lte = end;
  }

  return createdAt;
}

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const { searchParams } = new URL(request.url);
    const createdAt = parseDateRange(searchParams);
    const businessId = tenant.businessId;
    const activeMatch = { businessId, isActive: true };
    const logMatch = {
      businessId,
      ...(createdAt.$gte || createdAt.$lte ? { createdAt } : {}),
    };

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
      recentAdjustments,
      recentPurchases,
    ] = await Promise.all([
      Product.countDocuments(activeMatch),
      Product.aggregate<{ total: number }>([
        { $match: activeMatch },
        { $group: { _id: null, total: { $sum: "$currentStock" } } },
      ]),
      Product.aggregate<{ value: number }>([
        { $match: activeMatch },
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
        ...activeMatch,
        $expr: { $gt: ["$currentStock", "$minStockLevel"] },
      }),
      Product.countDocuments({
        ...activeMatch,
        $expr: {
          $and: [
            { $gt: ["$currentStock", 0] },
            { $lte: ["$currentStock", "$minStockLevel"] },
          ],
        },
      }),
      Product.countDocuments({ ...activeMatch, currentStock: { $lte: 0 } }),
      InventoryLog.aggregate<{
        _id: string;
        stockIn: number;
        stockOut: number;
      }>([
        { $match: logMatch },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            stockIn: {
              $sum: {
                $cond: [
                  { $in: ["$movementType", [...STOCK_IN_MOVEMENT_TYPES]] },
                  "$quantity",
                  {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$movementType", "CORRECTION"] },
                          { $gt: ["$newStock", "$previousStock"] },
                        ],
                      },
                      "$quantity",
                      0,
                    ],
                  },
                ],
              },
            },
            stockOut: {
              $sum: {
                $cond: [
                  { $in: ["$movementType", [...STOCK_OUT_MOVEMENT_TYPES]] },
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
        { $match: activeMatch },
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
        { $match: activeMatch },
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
        ...activeMatch,
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
      Product.find({ ...activeMatch, currentStock: { $lte: 0 } })
        .populate("category", "name")
        .sort({ updatedAt: -1 })
        .limit(8)
        .lean(),
      InventoryLog.find(logMatch)
        .populate("product", "name sku")
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      StockAdjustment.find({ businessId })
        .populate("product", "name sku")
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      Purchase.find({ businessId })
        .sort({ createdAt: -1 })
        .limit(6)
        .select(
          "purchaseNumber supplierName supplierInvoiceNumber total status purchaseDate",
        )
        .lean(),
    ]);

    const chartColors = [
      "#A3CA69",
      "#9299C9",
      "#7EAB3A",
      "#E5F0D5",
      "#B8BFD9",
      "#C5DF8F",
      "#252B24",
      "#858C80",
    ];

    const withReorder = <T extends { currentStock?: number; minStockLevel?: number }>(
      product: T,
    ) => {
      const currentStock = Number(product.currentStock ?? 0);
      const minStockLevel = Number(product.minStockLevel ?? 0);
      return {
        ...product,
        stockStatus: getStockStatus(currentStock, minStockLevel),
        suggestedReorder: suggestedReorderQuantity(
          currentStock,
          minStockLevel,
          tenant.reorderMultiple,
        ),
      };
    };

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
        lowStockAlerts: lowStockAlerts.map((product) => withReorder(product)),
        outOfStockProducts: outOfStockList.map((product) => withReorder(product)),
        recentMovements,
        recentAdjustments,
        recentPurchases,
        reorderMultiple: tenant.reorderMultiple,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
