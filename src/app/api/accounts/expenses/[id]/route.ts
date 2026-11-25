import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
} from "@/lib/api";
import { reverseExpense } from "@/lib/expense-service";
import { scopeFromTenant } from "@/lib/inventory-stock";
import { requireTenant } from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;
    if (!isValidObjectId(id)) return jsonError("Invalid expense ID.", 400);
    const expense = await reverseExpense({
      scope: scopeFromTenant(tenant),
      expenseId: id,
    });
    return jsonOk({
      data: { _id: String(expense._id), softDeleted: true },
      message: "Expense reversed. Cashbook entries were offset with reversals.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
