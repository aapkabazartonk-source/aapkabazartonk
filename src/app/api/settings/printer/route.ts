import { handleApiError, jsonOk } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import {
  getResolvedSettings,
  updatePrinterSettings,
} from "@/lib/settings-service";
import { requireTenant } from "@/lib/tenant";
import { printerSettingsSchema } from "@/lib/validators/settings";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const settings = await getResolvedSettings(tenant);
    return jsonOk({ data: settings.printer });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const tenant = await requireTenant(request);
    assertPermission(tenant.role, "settings.manage");
    const body = await request.json();
    const parsed = printerSettingsSchema.parse(body);
    await updatePrinterSettings(tenant, parsed);
    const settings = await getResolvedSettings(tenant);
    return jsonOk({ data: settings.printer });
  } catch (error) {
    return handleApiError(error);
  }
}
