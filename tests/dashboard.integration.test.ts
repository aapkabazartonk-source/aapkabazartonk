import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, describe, it } from "node:test";
import { Types } from "mongoose";

function loadEnv() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnv();

describe("dashboard integration", { concurrency: 1 }, () => {
  after(async () => {
    const mongoose = await import("mongoose");
    await mongoose.disconnect();
  });

  it("returns live KPIs from completed sales and matches analytics for today", async () => {
    const { connectToDatabase } = await import("../src/lib/db.ts");
    await connectToDatabase();
    const { Business } = await import("../src/models/Business.ts");
    const { Store } = await import("../src/models/Store.ts");
    const { Category } = await import("../src/models/Category.ts");
    const { Product } = await import("../src/models/Product.ts");
    const { Sale } = await import("../src/models/Sale.ts");
    const { Payment } = await import("../src/models/Payment.ts");
    const { Supplier } = await import("../src/models/Supplier.ts");
    const { getOverview } = await import("../src/lib/analytics/service.ts");
    const { getDashboardOverview } =
      await import("../src/lib/dashboard-service.ts");
    const { parseAnalyticsQuery } = await import("../src/lib/analytics/query.ts");

    const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const now = new Date("2026-11-10T12:00:00.000Z");
    const businessIds: Types.ObjectId[] = [];

    try {
      const business = await Business.create({
        name: `Dash ${stamp}`,
        code: `D${stamp}`.slice(0, 40),
        isActive: true,
      });
      businessIds.push(business._id);

      const store = await Store.create({
        businessId: business._id,
        name: "Main",
        code: "MAIN",
        isDefault: true,
        isActive: true,
      });

      const category = await Category.create({
        businessId: business._id,
        name: `Cat ${stamp}`,
        normalizedName: `cat ${stamp}`.toLowerCase(),
        slug: `cat-${stamp}`,
        isActive: true,
      });

      const product = await Product.create({
        businessId: business._id,
        storeId: store._id,
        name: `Rice ${stamp}`,
        sku: `SKU-${stamp}`,
        category: category._id,
        purchasePrice: 40,
        sellingPrice: 50,
        currentStock: 2,
        minStockLevel: 5,
        unit: "kg",
        gstRate: 0,
        isActive: true,
      });

      await Product.create({
        businessId: business._id,
        storeId: store._id,
        name: `Inactive ${stamp}`,
        sku: `SKU-I-${stamp}`,
        category: category._id,
        purchasePrice: 1000,
        sellingPrice: 1200,
        currentStock: 100,
        minStockLevel: 1,
        unit: "piece",
        gstRate: 0,
        isActive: false,
      });

      await Supplier.create({
        businessId: business._id,
        name: `Supplier ${stamp}`,
        phone: "9876543210",
        openingBalance: 250,
        currentBalance: 250,
        isActive: true,
      });

      const snapshot = {
        businessName: `Dash ${stamp}`,
        legalName: "",
        gstin: "",
        isGstRegistered: true,
        stateCode: "27",
        stateName: "Maharashtra",
        address: "",
        phone: "",
        storeName: "Main",
        storeCode: "MAIN",
        pricesIncludeGst: false,
        customerName: "Walk-in customer",
        customerPhone: "",
        customerGstin: "",
        customerAddress: "",
        customerStateCode: "27",
        customerStateName: "Maharashtra",
        supplyType: "INTRA" as const,
        placeOfSupply: "Maharashtra",
        paperSize: "80mm",
      };

      const sale = await Sale.create({
        businessId: business._id,
        storeId: store._id,
        saleNumber: `DS-${stamp}`.slice(0, 40),
        invoiceNumber: `DI-${stamp}`.slice(0, 40),
        idempotencyKey: `dash-${stamp}`,
        items: [
          {
            product: product._id,
            productName: product.name,
            sku: product.sku,
            barcode: "",
            quantity: 1,
            unit: "kg",
            unitPrice: 118,
            discount: 0,
            billDiscountShare: 0,
            hsn: "",
            taxRate: 18,
            taxableAmount: 100,
            cgst: 9,
            sgst: 9,
            igst: 0,
            taxAmount: 18,
            finalAmount: 118,
          },
        ],
        subtotal: 100,
        itemDiscount: 0,
        billDiscount: 0,
        taxableAmount: 100,
        cgst: 9,
        sgst: 9,
        igst: 0,
        totalTax: 18,
        grandTotal: 118,
        amountPaid: 118,
        balanceDue: 0,
        changeGiven: 0,
        paymentStatus: "PAID",
        saleStatus: "COMPLETED",
        invoiceType: "TAX_INVOICE",
        supplyType: "INTRA",
        pricesIncludeGst: false,
        notes: "DASH_TEST",
        invoiceSnapshot: snapshot,
        createdAt: now,
        updatedAt: now,
      });

      await Payment.create({
        businessId: business._id,
        storeId: store._id,
        sale: sale._id,
        sequence: 1,
        paymentMethod: "CASH",
        amount: 118,
        tenderedAmount: 118,
        changeGiven: 0,
        referenceNumber: "",
        status: "CONFIRMED",
        verification: "NOT_APPLICABLE",
        createdAt: now,
        updatedAt: now,
      });

      const scope = { businessId: business._id, storeId: store._id };
      const dashboard = await getDashboardOverview(scope, "today", now);
      const analytics = await getOverview(
        scope,
        parseAnalyticsQuery(new URLSearchParams("preset=today"), now),
      );

      assert.equal(dashboard.kpis.todaySales.current, 100);
      assert.equal(dashboard.kpis.todayBills.current, 1);
      assert.equal(dashboard.kpis.averageBill.current, 118);
      assert.equal(dashboard.kpis.lowStockProducts.current, 1);
      assert.equal(dashboard.kpis.inventoryValue.current, 80);
      assert.equal(dashboard.kpis.supplierPayables.current, 250);
      assert.equal(dashboard.recentSales.length, 1);
      assert.equal(dashboard.recentSales[0]?.invoiceNumber, `DI-${stamp}`.slice(0, 40).toUpperCase());
      assert.equal(dashboard.recentSales[0]?.paymentMethod, "Cash");
      assert.equal(dashboard.topProducts[0]?.unitsSold, 1);
      assert.ok(dashboard.salesTrend.points.length > 0);

      assert.equal(
        dashboard.kpis.todaySales.current,
        analytics.kpis.netSales.current,
      );
      assert.equal(
        dashboard.kpis.todayBills.current,
        analytics.kpis.bills.current,
      );
      assert.equal(
        dashboard.kpis.averageBill.current,
        analytics.kpis.averageBill.current,
      );
      assert.equal(
        dashboard.kpis.inventoryValue.current,
        analytics.kpis.inventoryValue.current,
      );
      assert.equal(
        dashboard.kpis.supplierPayables.current,
        analytics.kpis.payables.current,
      );
    } finally {
      if (businessIds.length > 0) {
        const scoped = { businessId: { $in: businessIds } };
        await Promise.all([
          Sale.collection.deleteMany(scoped),
          Payment.collection.deleteMany(scoped),
          Product.deleteMany(scoped),
          Category.deleteMany(scoped),
          Supplier.deleteMany(scoped),
          Store.deleteMany(scoped),
          Business.deleteMany({ _id: { $in: businessIds } }),
        ]);
      }
    }
  });
});
