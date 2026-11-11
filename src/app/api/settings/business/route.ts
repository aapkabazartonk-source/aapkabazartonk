import { handleApiError, jsonOk } from "@/lib/api";
import { assertPermission } from "@/lib/permissions";
import {
  getResolvedSettings,
  updateBusinessProfile,
  updateTaxSettings,
} from "@/lib/settings-service";
import { requireTenant } from "@/lib/tenant";
import { businessSettingsSchema } from "@/lib/validators/business-settings";
import { businessProfileSchema } from "@/lib/validators/settings";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const settings = await getResolvedSettings(tenant);
    return jsonOk({
      data: {
        ...settings.profile,
        isGstRegistered: settings.tax.isGstRegistered,
        pricesIncludeGst: settings.tax.pricesIncludeGst,
        gstin: settings.tax.gstin,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const tenant = await requireTenant(request);
    assertPermission(tenant.role, "settings.manage");
    const body = await request.json();

    // Accept full legacy payload or profile-only fields.
    if (
      "isGstRegistered" in body ||
      "pricesIncludeGst" in body ||
      "gstin" in body
    ) {
      const parsed = businessSettingsSchema.parse(body);
      await updateBusinessProfile(tenant, parsed);
      await updateTaxSettings(tenant, {
        isGstRegistered: parsed.isGstRegistered,
        pricesIncludeGst: parsed.pricesIncludeGst,
        gstin: parsed.gstin,
        stateCode: parsed.stateCode,
        state: parsed.state,
      });
    } else {
      const parsed = businessProfileSchema.parse(body);
      await updateBusinessProfile(tenant, parsed);
    }

    const settings = await getResolvedSettings(tenant);
    return jsonOk({
      data: {
        ...settings.profile,
        isGstRegistered: settings.tax.isGstRegistered,
        pricesIncludeGst: settings.tax.pricesIncludeGst,
        gstin: settings.tax.gstin,
        saved: true,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
