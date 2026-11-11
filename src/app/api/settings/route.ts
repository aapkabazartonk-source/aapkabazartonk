import { handleApiError, jsonOk } from "@/lib/api";
import { getResolvedSettings } from "@/lib/settings-service";
import { requireTenant } from "@/lib/tenant";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const data = await getResolvedSettings(tenant);
    return jsonOk({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
