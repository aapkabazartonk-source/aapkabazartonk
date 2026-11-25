import { handleApiError, jsonOk } from "@/lib/api";
import {
  FINANCE_PRESETS,
  getAccountsProfitLoss,
  type FinancePreset,
} from "@/lib/financial-overview-service";
import { requireTenant } from "@/lib/tenant";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const { searchParams } = new URL(request.url);
    const presetRaw = searchParams.get("preset") || "this_month";
    const preset = (
      FINANCE_PRESETS.includes(presetRaw as (typeof FINANCE_PRESETS)[number])
        ? presetRaw
        : "this_month"
    ) as FinancePreset;

    const data = await getAccountsProfitLoss(
      { businessId: tenant.businessId, storeId: tenant.storeId },
      {
        preset,
        from: searchParams.get("from"),
        to: searchParams.get("to"),
      },
    );
    return jsonOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}
