import { handleApiError, jsonOk } from "@/lib/api";
import {
  createExpenseCategory,
  listExpenseCategories,
} from "@/lib/expense-service";
import { requireTenant } from "@/lib/tenant";
import { z } from "zod";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const data = await listExpenseCategories(tenant.businessId);
    return jsonOk({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const body = z
      .object({ name: z.string().trim().min(1).max(120) })
      .parse(await request.json());
    const category = await createExpenseCategory({
      businessId: tenant.businessId,
      name: body.name,
    });
    return jsonOk(
      {
        data: {
          _id: String(category._id),
          name: category.name,
          isSystem: category.isSystem,
          isActive: category.isActive,
        },
      },
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
