import {
  escapeRegex,
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
  parsePagination,
} from "@/lib/api";
import { INVENTORY_MOVEMENT_TYPES } from "@/lib/constants";
import { requireTenant } from "@/lib/tenant";
import { InventoryLog } from "@/models/InventoryLog";
import { Product } from "@/models/Product";
import { User } from "@/models/User";

// Ensure User is registered for performedBy populate
void User;

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const search = (searchParams.get("search") || "").trim();
    const movementType = searchParams.get("movementType");
    const categoryId = searchParams.get("category");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const format = searchParams.get("format");

    const filter: Record<string, unknown> = {
      businessId: tenant.businessId,
    };
    const safeSearch = escapeRegex(search);

    if (
      movementType &&
      INVENTORY_MOVEMENT_TYPES.includes(
        movementType as (typeof INVENTORY_MOVEMENT_TYPES)[number],
      )
    ) {
      filter.movementType = movementType;
    }

    if (from || to) {
      const createdAt: { $gte?: Date; $lte?: Date } = {};
      if (from) createdAt.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        createdAt.$lte = end;
      }
      filter.createdAt = createdAt;
    }

    if (categoryId) {
      if (!isValidObjectId(categoryId)) {
        return jsonError("Invalid category filter.", 400);
      }
      const productIds = await Product.find({
        businessId: tenant.businessId,
        $or: [{ category: categoryId }, { subcategory: categoryId }],
      })
        .select("_id")
        .lean();
      filter.product = { $in: productIds.map((p) => p._id) };
    }

    if (search) {
      const matchedProducts = await Product.find({
        businessId: tenant.businessId,
        $or: [
          { name: { $regex: safeSearch, $options: "i" } },
          { sku: { $regex: safeSearch, $options: "i" } },
        ],
      })
        .select("_id")
        .lean();

      filter.$or = [
        { product: { $in: matchedProducts.map((p) => p._id) } },
        { reason: { $regex: safeSearch, $options: "i" } },
        { referenceNumber: { $regex: safeSearch, $options: "i" } },
        { notes: { $regex: safeSearch, $options: "i" } },
      ];
    }

    if (format === "csv") {
      const rows = await InventoryLog.find(filter)
        .populate("product", "name sku")
        .populate("performedBy", "name email")
        .sort({ createdAt: -1 })
        .limit(5000)
        .lean();

      const header = [
        "Date",
        "Product",
        "SKU",
        "Movement Type",
        "Previous Stock",
        "Quantity",
        "New Stock",
        "Reference Number",
        "Reason",
        "User",
      ];

      const escape = (value: unknown) => {
        const text = String(value ?? "");
        if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
        return text;
      };

      const lines = [
        header.join(","),
        ...rows.map((row) => {
          const product =
            row.product && typeof row.product === "object"
              ? (row.product as { name?: string; sku?: string })
              : null;
          const performer =
            row.performedBy && typeof row.performedBy === "object"
              ? (row.performedBy as { name?: string; email?: string })
              : null;

          return [
            new Date(row.createdAt).toISOString(),
            product?.name ?? "",
            product?.sku ?? "",
            row.movementType,
            row.previousStock,
            row.quantity,
            row.newStock,
            row.referenceNumber || "",
            row.reason,
            performer?.name || performer?.email || "",
          ]
            .map(escape)
            .join(",");
        }),
      ];

      return new Response(lines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="inventory-history.csv"`,
        },
      });
    }

    const [total, logs] = await Promise.all([
      InventoryLog.countDocuments(filter),
      InventoryLog.find(filter)
        .populate({
          path: "product",
          select: "name sku images category",
          populate: { path: "category", select: "name" },
        })
        .populate("performedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return jsonOk({
      data: logs,
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

/** Inventory logs are immutable through normal application APIs. */
export async function DELETE() {
  return jsonError("Inventory history is immutable and cannot be deleted.", 405);
}

export async function PATCH() {
  return jsonError("Inventory history is immutable and cannot be modified.", 405);
}

export async function PUT() {
  return jsonError("Inventory history is immutable and cannot be modified.", 405);
}
