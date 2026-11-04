import {
  escapeRegex,
  handleApiError,
  jsonError,
  jsonOk,
  parsePagination,
} from "@/lib/api";
import { listSales } from "@/lib/billing-service";
import { SALE_PAYMENT_STATUSES, type SalePaymentStatus } from "@/lib/constants";
import { requireTenant } from "@/lib/tenant";

function parseDate(value: string | null, endOfDay: boolean) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const search = (searchParams.get("search") || "").trim();
    const status = searchParams.get("paymentStatus");
    const from = parseDate(searchParams.get("from"), false);
    const to = parseDate(searchParams.get("to"), true);
    if (from === null || to === null) {
      return jsonError("Enter a valid date filter.", 400);
    }

    const filter: Record<string, unknown> = {};
    if (
      status &&
      SALE_PAYMENT_STATUSES.includes(status as SalePaymentStatus)
    ) {
      filter.paymentStatus = status;
    }
    if (from || to) {
      filter.createdAt = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {}),
      };
    }
    if (search) {
      const pattern = escapeRegex(search);
      filter.$or = [
        { invoiceNumber: { $regex: pattern, $options: "i" } },
        { saleNumber: { $regex: pattern, $options: "i" } },
        { "invoiceSnapshot.customerName": { $regex: pattern, $options: "i" } },
        { "invoiceSnapshot.customerPhone": { $regex: pattern, $options: "i" } },
        { "items.productName": { $regex: pattern, $options: "i" } },
        { "items.sku": { $regex: pattern, $options: "i" } },
        { "items.barcode": { $regex: pattern, $options: "i" } },
      ];
    }

    const result = await listSales({
      businessId: tenant.businessId,
      filter,
      page,
      limit,
      skip,
    });
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
