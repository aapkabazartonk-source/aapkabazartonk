import { handleApiError, jsonOk } from "@/lib/api";
import { checkoutSale } from "@/lib/billing-service";
import { scopeFromTenant } from "@/lib/inventory-stock";
import { requireTenant } from "@/lib/tenant";
import { checkoutSchema } from "@/lib/validators/billing";

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const body = await request.json();
    const headerKey = request.headers.get("Idempotency-Key")?.trim();
    if (
      headerKey &&
      body &&
      typeof body === "object" &&
      !("idempotencyKey" in body && (body as { idempotencyKey?: string }).idempotencyKey)
    ) {
      (body as { idempotencyKey?: string }).idempotencyKey = headerKey;
    }

    const parsed = checkoutSchema.parse(body);
    const result = await checkoutSale({
      data: parsed,
      scope: scopeFromTenant(tenant),
    });
    return jsonOk({ data: result }, result.replayed ? 200 : 201);
  } catch (error) {
    return handleApiError(error);
  }
}
