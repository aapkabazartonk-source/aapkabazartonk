import { handleApiError, jsonOk } from "@/lib/api";
import { readAnalyticsRequest } from "@/lib/analytics/http";
import { getProductPerformance } from "@/lib/analytics/service";

export async function GET(request: Request) {
  try {
    const { scope, query } = await readAnalyticsRequest(request);
    return jsonOk(await getProductPerformance(scope, query));
  } catch (error) {
    return handleApiError(error);
  }
}
