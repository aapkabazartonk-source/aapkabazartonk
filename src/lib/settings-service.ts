import { Types } from "mongoose";
import { stateName } from "@/lib/india-states";
import { hashPassword, verifyPassword } from "@/lib/password";
import { permissionsForRole } from "@/lib/permissions";
import { TenantError, type TenantContext } from "@/lib/tenant";
import type {
  BillingSettingsValues,
  BusinessProfileValues,
  InvoiceSettingsValues,
  PrinterSettingsValues,
  SecuritySettingsValues,
  TaxSettingsValues,
} from "@/lib/validators/settings";
import { Business } from "@/models/Business";
import {
  BusinessSettings,
  DEFAULT_BILLING_SETTINGS,
  DEFAULT_INVOICE_SETTINGS,
  DEFAULT_PRINTER_SETTINGS,
  DEFAULT_SECURITY_SETTINGS,
  type IBusinessSettingsBilling,
  type IBusinessSettingsInvoice,
  type IBusinessSettingsPrinter,
  type IBusinessSettingsSecurity,
} from "@/models/BusinessSettings";
import { Store } from "@/models/Store";
import { User } from "@/models/User";

export async function ensureBusinessSettings(businessId: Types.ObjectId) {
  const existing = await BusinessSettings.findOne({ businessId });
  if (existing) return existing;
  return BusinessSettings.create({ businessId });
}

function mergeInvoice(
  value?: Partial<IBusinessSettingsInvoice> | null,
): IBusinessSettingsInvoice {
  return { ...DEFAULT_INVOICE_SETTINGS, ...(value ?? {}) };
}

function mergePrinter(
  value?: Partial<IBusinessSettingsPrinter> | null,
): IBusinessSettingsPrinter {
  return { ...DEFAULT_PRINTER_SETTINGS, ...(value ?? {}) };
}

function mergeBilling(
  value?: Partial<IBusinessSettingsBilling> | null,
): IBusinessSettingsBilling {
  return {
    ...DEFAULT_BILLING_SETTINGS,
    ...(value ?? {}),
    enabledPaymentMethods:
      value?.enabledPaymentMethods?.length
        ? value.enabledPaymentMethods
        : [...DEFAULT_BILLING_SETTINGS.enabledPaymentMethods],
  };
}

function mergeSecurity(
  value?: Partial<IBusinessSettingsSecurity> | null,
): IBusinessSettingsSecurity {
  return { ...DEFAULT_SECURITY_SETTINGS, ...(value ?? {}) };
}

export async function getResolvedSettings(tenant: TenantContext) {
  const [business, store, settingsDoc] = await Promise.all([
    Business.findById(tenant.businessId).lean(),
    Store.findOne({ _id: tenant.storeId, businessId: tenant.businessId }).lean(),
    ensureBusinessSettings(tenant.businessId).then((doc) =>
      BusinessSettings.findById(doc._id).lean(),
    ),
  ]);

  if (!business || !store) {
    throw new TenantError("Business or store not found.", 404);
  }

  const invoice = mergeInvoice(settingsDoc?.invoice);
  const printer = mergePrinter(settingsDoc?.printer);
  const billing = mergeBilling(settingsDoc?.billing);
  const security = mergeSecurity(settingsDoc?.security);

  return {
    profile: {
      name: business.name,
      legalName: business.legalName ?? "",
      ownerName: business.ownerName ?? "",
      storeName: store.name,
      logoUrl: business.logoUrl ?? "",
      phone: business.phone || store.phone || "",
      email: business.email ?? "",
      address: business.address || store.address || "",
      city: business.city || store.city || "",
      stateCode: business.stateCode || store.stateCode || "",
      stateName: business.state || stateName(business.stateCode),
      pincode: business.pincode || store.pincode || "",
      country: business.country || "India",
      businessType: business.businessType || "retail",
      financialYearStartMonth: business.financialYearStartMonth ?? 4,
    },
    tax: {
      isGstRegistered: Boolean(business.isGstRegistered),
      pricesIncludeGst: Boolean(business.pricesIncludeGst),
      gstin: business.gstin ?? "",
      stateCode: business.stateCode || store.stateCode || "",
      stateName: business.state || stateName(business.stateCode),
      invoiceEligibility: business.isGstRegistered
        ? ("TAX_INVOICE_OR_BILL_OF_SUPPLY" as const)
        : ("BILL_OF_SUPPLY_ONLY" as const),
      notes:
        "Product GST rates are set per product (HSN/SAC). Settings do not hardcode a single tax rate.",
    },
    invoice,
    printer,
    billing,
    security: {
      requirePasswordChangeOnNextLogin: security.requirePasswordChangeOnNextLogin,
      sessionTimeoutMinutes: security.sessionTimeoutMinutes,
      authIntegrated: tenant.authIntegrated,
      passwordChangeSupported: tenant.authIntegrated,
      sessionManagementSupported: tenant.authIntegrated,
      activeSessionsSupported: false,
    },
    permissions: {
      role: tenant.role,
      permissions: permissionsForRole(tenant.role),
      authIntegrated: tenant.authIntegrated,
      migrationNote: null,
    },
    meta: {
      businessId: String(business._id),
      storeId: String(store._id),
      userId: tenant.userId,
    },
  };
}

export async function updateBusinessProfile(
  tenant: TenantContext,
  data: BusinessProfileValues,
) {
  await Promise.all([
    Business.updateOne(
      { _id: tenant.businessId },
      {
        $set: {
          name: data.name,
          legalName: data.legalName,
          ownerName: data.ownerName,
          logoUrl: data.logoUrl,
          phone: data.phone,
          email: data.email,
          address: data.address,
          city: data.city,
          state: data.state,
          stateCode: data.stateCode,
          pincode: data.pincode,
          country: data.country,
          businessType: data.businessType,
          financialYearStartMonth: data.financialYearStartMonth,
        },
      },
    ),
    Store.updateOne(
      { _id: tenant.storeId, businessId: tenant.businessId },
      {
        $set: {
          name: data.storeName,
          phone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          stateCode: data.stateCode,
          pincode: data.pincode,
        },
      },
    ),
  ]);
}

export async function updateTaxSettings(
  tenant: TenantContext,
  data: TaxSettingsValues,
) {
  await Business.updateOne(
    { _id: tenant.businessId },
    {
      $set: {
        isGstRegistered: data.isGstRegistered,
        pricesIncludeGst: data.pricesIncludeGst,
        gstin: data.gstin,
        stateCode: data.stateCode,
        state: data.state,
      },
    },
  );
  await Store.updateOne(
    { _id: tenant.storeId, businessId: tenant.businessId },
    {
      $set: {
        stateCode: data.stateCode,
        state: data.state,
      },
    },
  );
}

export async function updateInvoiceSettings(
  tenant: TenantContext,
  data: InvoiceSettingsValues,
) {
  await ensureBusinessSettings(tenant.businessId);
  await BusinessSettings.updateOne(
    { businessId: tenant.businessId },
    { $set: { invoice: data } },
  );
}

export async function updatePrinterSettings(
  tenant: TenantContext,
  data: PrinterSettingsValues,
) {
  await ensureBusinessSettings(tenant.businessId);
  await BusinessSettings.updateOne(
    { businessId: tenant.businessId },
    { $set: { printer: data } },
  );
}

export async function updateBillingSettings(
  tenant: TenantContext,
  data: BillingSettingsValues,
) {
  await ensureBusinessSettings(tenant.businessId);
  await BusinessSettings.updateOne(
    { businessId: tenant.businessId },
    { $set: { billing: data } },
  );
}

export async function updateSecuritySettings(
  tenant: TenantContext,
  data: SecuritySettingsValues,
) {
  await ensureBusinessSettings(tenant.businessId);
  await BusinessSettings.updateOne(
    { businessId: tenant.businessId },
    {
      $set: {
        "security.requirePasswordChangeOnNextLogin":
          data.requirePasswordChangeOnNextLogin,
        "security.sessionTimeoutMinutes": data.sessionTimeoutMinutes,
      },
    },
  );

  if (data.newPassword) {
    if (!tenant.authIntegrated || !tenant.userId) {
      throw new TenantError(
        "Password change requires an authenticated session. Sign-in is not integrated yet.",
        409,
      );
    }
    const user = await User.findOne({
      _id: tenant.userId,
      businessId: tenant.businessId,
      isActive: true,
    });
    if (!user) {
      throw new TenantError("User not found.", 404);
    }
    const ok = await verifyPassword(data.currentPassword ?? "", user.passwordHash);
    if (!ok) {
      throw new TenantError("Current password is incorrect.", 400);
    }
    user.passwordHash = await hashPassword(data.newPassword);
    user.mustChangePassword = false;
    user.lastPasswordChangeAt = new Date();
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    await user.save();
  }
}

/** Load billing prefs used by POS / checkout (server-side). */
export async function getBillingRuntimeSettings(businessId: Types.ObjectId) {
  const doc = await ensureBusinessSettings(businessId);
  const lean = await BusinessSettings.findById(doc._id).lean();
  return {
    invoice: mergeInvoice(lean?.invoice),
    printer: mergePrinter(lean?.printer),
    billing: mergeBilling(lean?.billing),
  };
}
