import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import mongoose from "mongoose";

function loadEnv() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnv();

describe("settings integration", { concurrency: 1 }, () => {
  it("updates profile/tax/invoice/billing and keeps historical invoice numbers", async () => {
    const { connectToDatabase } = await import("../src/lib/db.ts");
    await connectToDatabase();

    const { resolveTestOwnerTenant } = await import("./helpers/tenant-test.ts");
    const {
      getResolvedSettings,
      updateBusinessProfile,
      updateTaxSettings,
      updateInvoiceSettings,
      updateBillingSettings,
      getBillingRuntimeSettings,
    } = await import("../src/lib/settings-service.ts");
    const { Business } = await import("../src/models/Business.ts");
    const { Sale } = await import("../src/models/Sale.ts");
    const { GSTIN_REGEX } = await import("../src/lib/india-states.ts");
    const { taxSettingsSchema, invoiceSettingsSchema } = await import(
      "../src/lib/validators/settings.ts"
    );

    const tenant = await resolveTestOwnerTenant();
    const stamp = Date.now().toString(36);

    // 1. Business profile update
    await updateBusinessProfile(tenant, {
      name: `Settings Biz ${stamp}`,
      legalName: "Settings Legal",
      ownerName: "Owner",
      storeName: "Main store",
      logoUrl: "https://example.com/logo.png",
      phone: "9876501234",
      email: `settings-${stamp}@example.com`,
      address: "1 Market Road",
      city: "Tonk",
      stateCode: "08",
      state: "Rajasthan",
      pincode: "304001",
      country: "India",
      businessType: "retail",
      financialYearStartMonth: 4,
    });

    // 2 + 3. GST registration + GSTIN validation
    const invalid = taxSettingsSchema.safeParse({
      isGstRegistered: true,
      pricesIncludeGst: false,
      gstin: "BAD",
      stateCode: "08",
    });
    assert.equal(invalid.success, false);
    assert.equal(GSTIN_REGEX.test("29AABCU9603R1ZM"), true);

    await updateTaxSettings(tenant, {
      isGstRegistered: true,
      pricesIncludeGst: false,
      gstin: "29AABCU9603R1ZM",
      stateCode: "29",
      state: "Karnataka",
    });

    // Cross-check state mismatch rejection
    const mismatch = taxSettingsSchema.safeParse({
      isGstRegistered: true,
      pricesIncludeGst: false,
      gstin: "29AABCU9603R1ZM",
      stateCode: "08",
    });
    assert.equal(mismatch.success, false);

    // 5 + 6. Invoice numbering uniqueness / prefix changes
    await updateInvoiceSettings(tenant, {
      taxInvoicePrefix: "TX",
      billOfSupplyPrefix: "BS",
      salePrefix: "SL",
      paperSize: "80mm",
      showLogo: true,
      showGstin: true,
      showAddress: true,
      footerNote: "Footer",
      termsAndConditions: "Terms",
      thankYouMessage: "Thanks",
      template: "standard",
    });

    const prefixClash = invoiceSettingsSchema.safeParse({
      taxInvoicePrefix: "SAME",
      billOfSupplyPrefix: "SAME",
      salePrefix: "SAL",
    });
    assert.equal(prefixClash.success, false);

    const runtime = await getBillingRuntimeSettings(tenant.businessId);
    assert.equal(runtime.invoice.taxInvoicePrefix, "TX");

    // 7. Historical invoice preservation — existing invoice numbers untouched
    const existing = await Sale.find({ businessId: tenant.businessId })
      .select("invoiceNumber")
      .limit(5)
      .lean();
    const before = existing.map((row) => row.invoiceNumber);
    await updateInvoiceSettings(tenant, {
      ...runtime.invoice,
      taxInvoicePrefix: "INVX",
    });
    const after = await Sale.find({ businessId: tenant.businessId })
      .select("invoiceNumber")
      .limit(5)
      .lean();
    assert.deepEqual(
      after.map((row) => row.invoiceNumber),
      before,
    );

    // 8 + 9. Printer/billing prefs persistence
    await updateBillingSettings(tenant, {
      defaultPaymentMethod: "UPI",
      enabledPaymentMethods: ["CASH", "UPI"],
      enableBillDiscount: true,
      maxBillDiscountPercent: 20,
      maxBillDiscountAmount: 500,
      defaultInvoiceTypePreference: "AUTO",
      showStockAvailability: true,
      searchIncludesBarcode: true,
      searchIncludesSku: true,
      requireCheckoutConfirmation: true,
      autoPrintAfterBilling: true,
      allowCreditSales: false,
      keyboardShortcutsEnabled: true,
    });

    // 12. Settings persistence + isolation scope
    const settings = await getResolvedSettings(tenant);
    assert.equal(settings.profile.name, `Settings Biz ${stamp}`);
    assert.equal(settings.tax.gstin, "29AABCU9603R1ZM");
    assert.equal(settings.invoice.taxInvoicePrefix, "INVX");
    assert.equal(settings.billing.defaultPaymentMethod, "UPI");
    assert.equal(settings.billing.allowCreditSales, false);
    assert.equal(settings.permissions.role, "owner");
    assert.ok(settings.permissions.permissions.includes("settings.manage"));

    const business = await Business.findById(tenant.businessId);
    assert.equal(business?.logoUrl, "https://example.com/logo.png");

    // Restore safer defaults for the shared workspace
    await updateTaxSettings(tenant, {
      isGstRegistered: false,
      pricesIncludeGst: false,
      gstin: "",
      stateCode: "08",
      state: "Rajasthan",
    });
    await updateInvoiceSettings(tenant, {
      taxInvoicePrefix: "INV",
      billOfSupplyPrefix: "BOS",
      salePrefix: "SAL",
      paperSize: "80mm",
      showLogo: true,
      showGstin: true,
      showAddress: true,
      footerNote: "",
      termsAndConditions: "",
      thankYouMessage: "Thank you for shopping with us!",
      template: "standard",
    });
    await updateBillingSettings(tenant, {
      defaultPaymentMethod: "CASH",
      enabledPaymentMethods: ["CASH", "UPI", "CARD", "BANK_TRANSFER"],
      enableBillDiscount: true,
      maxBillDiscountPercent: 100,
      maxBillDiscountAmount: 0,
      defaultInvoiceTypePreference: "AUTO",
      showStockAvailability: true,
      searchIncludesBarcode: true,
      searchIncludesSku: true,
      requireCheckoutConfirmation: true,
      autoPrintAfterBilling: false,
      allowCreditSales: true,
      keyboardShortcutsEnabled: true,
    });

    await mongoose.connection.close();
  });
});
