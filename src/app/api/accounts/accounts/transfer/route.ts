import { handleApiError, jsonOk } from "@/lib/api";
import { transferBetweenAccounts } from "@/lib/accounts-service";
import { scopeFromTenant } from "@/lib/inventory-stock";
import { requireTenant } from "@/lib/tenant";
import { z } from "zod";

const schema = z.object({
  fromAccountId: z.string().trim().min(1),
  toAccountId: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  entryDate: z.string().optional(),
  description: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(80),
});

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const body = schema.parse(await request.json());
    const data = await transferBetweenAccounts({
      scope: scopeFromTenant(tenant),
      data: body,
    });
    return jsonOk({ data }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
