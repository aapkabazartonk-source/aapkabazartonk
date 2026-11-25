import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
  parsePagination,
} from "@/lib/api";
import { listAccountLedger } from "@/lib/account-ledger";
import { requireTenant } from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;
    if (!isValidObjectId(id)) return jsonError("Invalid account ID.", 400);

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");

    const result = await listAccountLedger({
      businessId: tenant.businessId,
      accountId: id,
      page,
      limit,
      skip,
      from: fromRaw ? new Date(fromRaw) : undefined,
      to: toRaw ? new Date(toRaw) : undefined,
    });
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
