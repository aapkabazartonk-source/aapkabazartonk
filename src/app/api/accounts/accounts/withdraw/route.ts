import { handleApiError, jsonOk } from "@/lib/api";
import { recordManualMovement } from "@/lib/accounts-service";
import { scopeFromTenant } from "@/lib/inventory-stock";
import { requireTenant } from "@/lib/tenant";
import { z } from "zod";

const schema = z.object({
  accountId: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  entryDate: z.string().optional(),
  description: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(80),
});

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const body = schema.parse(await request.json());
    const row = await recordManualMovement({
      scope: scopeFromTenant(tenant),
      data: { ...body, kind: "WITHDRAWAL" },
    });
    return jsonOk({ data: row }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
