import {
  escapeRegex,
  handleApiError,
  jsonOk,
  parsePagination,
} from "@/lib/api";
import { scopeFromTenant } from "@/lib/inventory-stock";
import {
  createCustomer,
  getCustomerDashboardStats,
  listCustomers,
  normalizePhoneDigits,
  searchCustomerOptions,
} from "@/lib/customer-service";
import { requireTenant } from "@/lib/tenant";
import {
  customerCreateSchema,
  customerQuickCreateSchema,
} from "@/lib/validators/customer";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const search = (searchParams.get("search") || "").trim();
    const status = searchParams.get("status");
    const sort = searchParams.get("sort") || "createdAt";
    const order = searchParams.get("order") === "asc" ? 1 : -1;
    const activeOnly = searchParams.get("activeOnly") === "1";
    const options = searchParams.get("options") === "1";
    const statsOnly = searchParams.get("stats") === "1";

    if (statsOnly) {
      const stats = await getCustomerDashboardStats(tenant.businessId);
      return jsonOk({ stats });
    }

    if (options) {
      const data = await searchCustomerOptions({
        businessId: tenant.businessId,
        search,
        limit: Math.min(50, Number(searchParams.get("limit") || 20) || 20),
      });
      return jsonOk({ data });
    }

    const filter: Record<string, unknown> = {};

    if (activeOnly || status === "active" || !status) {
      filter.isActive = true;
      filter.deletedAt = null;
    } else if (status === "inactive") {
      filter.isActive = false;
    }
    // status === "all" returns active and inactive/soft-deleted customers

    if (search) {
      const safe = escapeRegex(search);
      const digits = normalizePhoneDigits(search);
      filter.$or = [
        { name: { $regex: safe, $options: "i" } },
        { phone: { $regex: safe, $options: "i" } },
        { email: { $regex: safe, $options: "i" } },
        ...(digits
          ? [{ phoneNormalized: { $regex: escapeRegex(digits), $options: "i" } }]
          : []),
      ];
    }

    const allowedSort = new Set([
      "createdAt",
      "name",
      "phone",
      "customerType",
      "updatedAt",
    ]);
    const sortField = allowedSort.has(sort) ? sort : "createdAt";

    const result = await listCustomers({
      businessId: tenant.businessId,
      filter,
      page,
      limit,
      skip,
      sortField,
      order: order as 1 | -1,
    });

    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const body = await request.json();
    const quick = Boolean(body?.quick);
    const parsed = quick
      ? customerQuickCreateSchema.parse(body)
      : customerCreateSchema.parse(body);
    const customer = await createCustomer({
      data: parsed,
      scope: scopeFromTenant(tenant),
    });

    return jsonOk(
      {
        data: {
          _id: String(customer._id),
          businessId: String(customer.businessId),
          storeId: customer.storeId ? String(customer.storeId) : null,
          name: customer.name,
          phone: customer.phone,
          email: customer.email ?? "",
          address: customer.address ?? "",
          city: customer.city ?? "",
          state: customer.state ?? "",
          stateCode: customer.stateCode ?? "",
          pincode: customer.pincode ?? "",
          gstin: customer.gstin ?? "",
          customerType: customer.customerType,
          isActive: customer.isActive,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt,
        },
      },
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
