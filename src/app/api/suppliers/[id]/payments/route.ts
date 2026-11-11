import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
  parsePagination,
} from "@/lib/api";
import { scopeFromTenant } from "@/lib/inventory-stock";
import {
  listSupplierPayments,
  recordSupplierPayment,
} from "@/lib/supplier-payment-service";
import { requireTenant } from "@/lib/tenant";
import { supplierPaymentCreateSchema } from "@/lib/validators/supplier-payment";

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

    const result = await listSupplierPayments({
      supplierId: id,
      businessId: tenant.businessId,
      page,
      limit,
    });

    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return jsonError("Invalid supplier ID.", 400);
    }

    const body = await request.json();
    const parsed = supplierPaymentCreateSchema.parse(body);
    const payment = await recordSupplierPayment({
      supplierId: id,
      data: parsed,
      scope: scopeFromTenant(tenant),
    });

    return jsonOk(
      {
        data: {
          ...payment.toObject(),
          _id: String(payment._id),
          businessId: String(payment.businessId),
          supplierId: String(payment.supplierId),
          allocatedPurchases: (payment.allocatedPurchases ?? []).map((row) => ({
            purchaseId: String(row.purchaseId),
            amount: row.amount,
          })),
          receipt: {
            title: "Supplier Payment Receipt",
            paymentNumber: payment.paymentNumber,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
            paymentDate: payment.paymentDate,
            referenceNumber: payment.referenceNumber,
            unallocatedAmount: payment.unallocatedAmount,
            notes: payment.notes,
          },
        },
      },
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
