import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
} from "@/lib/api";
import { EXPENSE_PAYMENT_METHODS } from "@/lib/constants";
import { payExpense } from "@/lib/expense-service";
import { scopeFromTenant } from "@/lib/inventory-stock";
import { requireTenant } from "@/lib/tenant";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({
  amount: z.coerce.number().positive(),
  paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS),
  accountId: z.string().trim().min(1),
  paymentDate: z.string().optional(),
  notes: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(80),
});

export async function POST(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;
    if (!isValidObjectId(id)) return jsonError("Invalid expense ID.", 400);
    const body = schema.parse(await request.json());
    const payment = await payExpense({
      scope: scopeFromTenant(tenant),
      expenseId: id,
      ...body,
    });
    return jsonOk({ data: { _id: String(payment._id) } }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
