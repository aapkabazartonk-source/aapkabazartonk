import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
  parsePagination,
} from "@/lib/api";
import { getSupplierLedger } from "@/lib/supplier-service";
import { requireTenant } from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return jsonError("Invalid supplier ID.", 400);
    }

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);

    const ledger = await getSupplierLedger({
      supplierId: id,
      businessId: tenant.businessId,
      page,
      limit,
    });

    return jsonOk(ledger);
  } catch (error) {
    return handleApiError(error);
  }
}
