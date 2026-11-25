import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
} from "@/lib/api";
import { updateAccount } from "@/lib/accounts-service";
import { TENDER_METHODS } from "@/lib/constants";
import { scopeFromTenant } from "@/lib/inventory-stock";
import { requireTenant } from "@/lib/tenant";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  linkedPaymentMethod: z.enum(TENDER_METHODS).nullable().optional(),
  allowNegative: z.boolean().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;
    if (!isValidObjectId(id)) return jsonError("Invalid account ID.", 400);
    const body = updateSchema.parse(await request.json());
    const account = await updateAccount({
      scope: scopeFromTenant(tenant),
      accountId: id,
      data: body,
    });
    return jsonOk({
      data: {
        ...account.toObject(),
        _id: String(account._id),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
