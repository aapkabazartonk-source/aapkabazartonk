import { assertPermission } from "@/lib/permissions";
import { requireTenant } from "@/lib/tenant";
import { parseAnalyticsQuery, type AnalyticsQuery } from "@/lib/analytics/query";
import type { AnalyticsScope } from "@/lib/analytics/service";

export async function readAnalyticsRequest(request: Request): Promise<{
  scope: AnalyticsScope;
  query: AnalyticsQuery;
}> {
  const tenant = await requireTenant(request);
  assertPermission(
    tenant.role,
    "reports.view",
    "You do not have permission to view business analytics.",
  );
  const query = parseAnalyticsQuery(new URL(request.url).searchParams);
  return {
    query,
    scope: {
      businessId: tenant.businessId,
      storeId: tenant.storeId,
    },
  };
}
