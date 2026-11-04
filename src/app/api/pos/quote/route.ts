import { handleApiError, jsonOk } from "@/lib/api";
import { quoteSale } from "@/lib/billing-service";
import { scopeFromTenant } from "@/lib/inventory-stock";
import { requireTenant } from "@/lib/tenant";
import { quoteSchema } from "@/lib/validators/billing";

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const body = await request.json();
    const parsed = quoteSchema.parse(body);
    const quote = await quoteSale({
      data: parsed,
      scope: scopeFromTenant(tenant),
    });
    return jsonOk({ data: quote });
  } catch (error) {
    return handleApiError(error);
  }
}
