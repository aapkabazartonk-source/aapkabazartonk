import { handleApiError, jsonOk } from "@/lib/api";
import { readAnalyticsRequest } from "@/lib/analytics/http";
import { getOverview } from "@/lib/analytics/service";

export async function GET(request: Request) {
  try {
    const { scope, query } = await readAnalyticsRequest(request);
    return jsonOk(await getOverview(scope, query));
  } catch (error) {
    return handleApiError(error);
  }
}
