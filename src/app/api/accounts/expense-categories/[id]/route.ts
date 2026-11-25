import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
} from "@/lib/api";
import { updateExpenseCategory } from "@/lib/expense-service";
import { requireTenant } from "@/lib/tenant";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;
    if (!isValidObjectId(id)) return jsonError("Invalid category ID.", 400);
    const body = updateSchema.parse(await request.json());
    if (body.name === undefined && body.isActive === undefined) {
      return jsonError("Nothing to update.", 400);
    }
    const category = await updateExpenseCategory({
      businessId: tenant.businessId,
      categoryId: id,
      name: body.name,
      isActive: body.isActive,
    });
    return jsonOk({
      data: {
        _id: String(category._id),
        name: category.name,
        isSystem: category.isSystem,
        isActive: category.isActive,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
