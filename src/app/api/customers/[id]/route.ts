import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
  parsePagination,
} from "@/lib/api";
import {
  deleteCustomer,
  getCustomerDetail,
  updateCustomer,
} from "@/lib/customer-service";
import { scopeFromTenant } from "@/lib/inventory-stock";
import { requireTenant } from "@/lib/tenant";
import { customerUpdateSchema } from "@/lib/validators/customer";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;
    if (!isValidObjectId(id)) {
      return jsonError("Invalid customer ID.", 400);
    }

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const detail = await getCustomerDetail({
      customerId: id,
      businessId: tenant.businessId,
      page,
      limit,
    });

    return jsonOk({ data: detail });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;
    if (!isValidObjectId(id)) {
      return jsonError("Invalid customer ID.", 400);
    }

    const body = await request.json();
    const parsed = customerUpdateSchema.parse(body);
    const customer = await updateCustomer({
      customerId: id,
      data: parsed,
      scope: scopeFromTenant(tenant),
    });

    return jsonOk({
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
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;
    if (!isValidObjectId(id)) {
      return jsonError("Invalid customer ID.", 400);
    }

    const result = await deleteCustomer({
      customerId: id,
      scope: scopeFromTenant(tenant),
    });

    return jsonOk({
      data: result,
      message: result.message,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
