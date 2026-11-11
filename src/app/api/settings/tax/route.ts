import { handleApiError, jsonOk } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import {
  getResolvedSettings,
  updateTaxSettings,
} from "@/lib/settings-service";
import { requireTenant } from "@/lib/tenant";
import { taxSettingsSchema } from "@/lib/validators/settings";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const settings = await getResolvedSettings(tenant);
    return jsonOk({ data: settings.tax });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const tenant = await requireTenant(request);
    assertPermission(tenant.role, "settings.manage");
    const body = await request.json();
    const parsed = taxSettingsSchema.parse(body);
    await updateTaxSettings(tenant, parsed);
    const settings = await getResolvedSettings(tenant);
    return jsonOk({ data: settings.tax });
  } catch (error) {
    return handleApiError(error);
  }
}
