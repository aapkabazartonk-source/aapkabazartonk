import { handleApiError, jsonOk } from "@/lib/api";
import { stateName } from "@/lib/india-states";
import { requireTenant } from "@/lib/tenant";
import { businessSettingsSchema } from "@/lib/validators/business-settings";
import { Business } from "@/models/Business";
import { Store } from "@/models/Store";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const [business, store] = await Promise.all([
      Business.findById(tenant.businessId).lean(),
      Store.findOne({ _id: tenant.storeId, businessId: tenant.businessId }).lean(),
    ]);
    if (!business || !store) {
      return jsonOk({ data: null });
    }

    return jsonOk({
      data: {
        name: business.name,
        legalName: business.legalName ?? "",
        storeName: store.name,
        phone: business.phone || store.phone || "",
        email: business.email ?? "",
        address: business.address || store.address || "",
        city: business.city || store.city || "",
        stateCode: business.stateCode || store.stateCode || "",
        stateName: business.state || stateName(business.stateCode),
        pincode: business.pincode || store.pincode || "",
        isGstRegistered: Boolean(business.isGstRegistered),
        pricesIncludeGst: Boolean(business.pricesIncludeGst),
        gstin: business.gstin ?? "",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const body = await request.json();
    const parsed = businessSettingsSchema.parse(body);

    await Business.updateOne(
      { _id: tenant.businessId },
      {
        $set: {
          name: parsed.name,
          legalName: parsed.legalName,
          phone: parsed.phone,
          email: parsed.email,
          address: parsed.address,
          city: parsed.city,
          state: parsed.state,
          stateCode: parsed.stateCode,
          pincode: parsed.pincode,
          isGstRegistered: parsed.isGstRegistered,
          pricesIncludeGst: parsed.pricesIncludeGst,
          gstin: parsed.gstin,
        },
      },
    );

    await Store.updateOne(
      { _id: tenant.storeId, businessId: tenant.businessId },
      {
        $set: {
          name: parsed.storeName,
          phone: parsed.phone,
          address: parsed.address,
          city: parsed.city,
          state: parsed.state,
          stateCode: parsed.stateCode,
          pincode: parsed.pincode,
        },
      },
    );

    return jsonOk({ data: { saved: true } });
  } catch (error) {
    return handleApiError(error);
  }
}
