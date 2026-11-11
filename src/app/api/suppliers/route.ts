import {
  escapeRegex,
  handleApiError,
  jsonOk,
  parsePagination,
} from "@/lib/api";
import { scopeFromTenant } from "@/lib/inventory-stock";
import {
  createSupplier,
  getSupplierDashboardStats,
} from "@/lib/supplier-service";
import { requireTenant } from "@/lib/tenant";
import { supplierCreateSchema } from "@/lib/validators/supplier";
import { Supplier } from "@/models/Supplier";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const search = (searchParams.get("search") || "").trim();
    const status = searchParams.get("status"); // active | inactive | all
    const sort = searchParams.get("sort") || "createdAt";
    const order = searchParams.get("order") === "asc" ? 1 : -1;
    const activeOnly = searchParams.get("activeOnly") === "1";
    const options = searchParams.get("options") === "1";

    const filter: Record<string, unknown> = {
      businessId: tenant.businessId,
    };

    if (activeOnly || options || status === "active") {
      filter.isActive = true;
    } else if (status === "inactive") {
      filter.isActive = false;
    }

    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { name: { $regex: safe, $options: "i" } },
        { phone: { $regex: safe, $options: "i" } },
        { gstin: { $regex: safe, $options: "i" } },
        { contactPerson: { $regex: safe, $options: "i" } },
      ];
    }

    if (options) {
      const suppliers = await Supplier.find(filter)
        .select("name phone gstin contactPerson currentBalance isActive")
        .sort({ name: 1 })
        .limit(200)
        .lean();
      return jsonOk({
        data: suppliers.map((row) => ({
          ...row,
          _id: String(row._id),
        })),
      });
    }

    const allowedSort = new Set([
      "createdAt",
      "name",
      "phone",
      "currentBalance",
      "openingBalance",
    ]);
    const sortField = allowedSort.has(sort) ? sort : "createdAt";

    const [total, suppliers, stats] = await Promise.all([
      Supplier.countDocuments(filter),
      Supplier.find(filter)
        .sort({ [sortField]: order })
        .skip(skip)
        .limit(limit)
        .lean(),
      getSupplierDashboardStats(tenant.businessId),
    ]);

    return jsonOk({
      data: suppliers.map((row) => ({
        ...row,
        _id: String(row._id),
        businessId: String(row.businessId),
        storeId: row.storeId ? String(row.storeId) : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const body = await request.json();
    const parsed = supplierCreateSchema.parse(body);
    const supplier = await createSupplier({
      data: parsed,
      scope: scopeFromTenant(tenant),
    });

    return jsonOk(
      {
        data: {
          ...supplier.toObject(),
          _id: String(supplier._id),
          businessId: String(supplier.businessId),
        },
      },
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
