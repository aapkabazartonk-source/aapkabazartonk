import { handleApiError, jsonOk } from "@/lib/api";
import {
  getDashboardOverview,
  parseDashboardPreset,
} from "@/lib/dashboard-service";
import { assertPermission } from "@/lib/permissions";
import { requireTenant } from "@/lib/tenant";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);
    assertPermission(
      tenant.role,
      "reports.view",
      "You do not have permission to view the overview dashboard.",
    );

    const preset = parseDashboardPreset(
      new URL(request.url).searchParams.get("preset"),
    );

    const data = await getDashboardOverview(
      {
        businessId: tenant.businessId,
        storeId: tenant.storeId,
      },
      preset,
    );

    return jsonOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}
