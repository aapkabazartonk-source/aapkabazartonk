import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, describe, it } from "node:test";
import { Types } from "mongoose";
import { parseAnalyticsQuery } from "../src/lib/analytics/query.ts";

function loadEnv() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnv();

describe("analytics integration", { concurrency: 1 }, () => {
  after(async () => {
    const mongoose = await import("mongoose");
    await mongoose.disconnect();
  });

  it("isolates tenants and keeps GST, credit, drafts, and catalog cost apart", async () => {
    const { connectToDatabase } = await import("../src/lib/db.ts");
    await connectToDatabase();
    const { Business } = await import("../src/models/Business.ts");
    const { Store } = await import("../src/models/Store.ts");
    const { Category } = await import("../src/models/Category.ts");
    const { Product } = await import("../src/models/Product.ts");
    const { Sale } = await import("../src/models/Sale.ts");
    const { Payment } = await import("../src/models/Payment.ts");
    const { Purchase } = await import("../src/models/Purchase.ts");
    const { Supplier } = await import("../src/models/Supplier.ts");
    const { SupplierPayment } = await import("../src/models/SupplierPayment.ts");
    const {
      getCategories,
      getInventory,
      getOverview,
      getPayments,
      getProductPerformance,
      getProfitLoss,
      getPurchases,
      getRevenue,
    } = await import("../src/lib/analytics/service.ts");

    const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const now = new Date();
    const businessIds: Types.ObjectId[] = [];

    try {
      const business = await Business.create({
        name: `Phase 7 ${stamp}`,
        code: `P7${stamp}`.slice(0, 40),
        isActive: true,
      });
      const other = await Business.create({
        name: `Phase 7 other ${stamp}`,
        code: `P7B${stamp}`.slice(0, 40),
        isActive: true,
      });
      businessIds.push(business._id);
      businessIds.push(other._id);

      const store = await Store.create({
        businessId: business._id,
        name: "Main",
        code: "MAIN",
        isDefault: true,
        isActive: true,
      });
      const otherStore = await Store.create({
        businessId: business._id,
        name: "Side",
        code: "SIDE",
        isActive: true,
      });
      const otherBusinessStore = await Store.create({
        businessId: other._id,
        name: "Other",
        code: "MAIN",
        isDefault: true,
        isActive: true,
      });
      const category = await Category.create({
        businessId: business._id,
        name: "Grocery",
        normalizedName: `grocery-${stamp}`,
        slug: `grocery-${stamp}`,
      });
      const rice = await Product.create({
        businessId: business._id,
        storeId: store._id,
        name: "Rice",
        sku: `RICE${stamp}`.slice(0, 40),
        barcode: "",
        description: "PHASE7_TEST",
        category: category._id,
        purchasePrice: 10,
        sellingPrice: 118,
        currentStock: 8,
        minStockLevel: 0,
        unit: "piece",
        hsn: "1006",
        gstRate: 18,
        images: [],
        isActive: true,
      });
      const soap = await Product.create({
        businessId: business._id,
        storeId: store._id,
        name: "Soap",
        sku: `SOAP${stamp}`.slice(0, 40),
        barcode: "",
        description: "PHASE7_TEST",
        category: category._id,
        purchasePrice: 5,
        sellingPrice: 50,
        currentStock: 5,
        minStockLevel: 2,
        unit: "piece",
        gstRate: 0,
        images: [],
        isActive: true,
      });

      await Supplier.create({
        businessId: business._id,
        name: "Acme",
        phone: "9999999999",
        openingBalance: 250,
        currentBalance: 250,
      });

      const snapshot = {
        businessName: "Phase 7",
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
      };

      const riceSale = await Sale.create({
        businessId: business._id,
        storeId: store._id,
        saleNumber: `S1${stamp}`.slice(0, 40),
        invoiceNumber: `I1${stamp}`.slice(0, 40),
        idempotencyKey: `p7-rice-${stamp}`,
        items: [
          {
            product: rice._id,
            productName: "Rice",
            sku: "RICE",
            barcode: "",
            quantity: 2,
            unit: "piece",
            unitPrice: 100,
            discount: 0,
            billDiscountShare: 0,
            hsn: "1006",
            taxRate: 18,
            taxableAmount: 200,
            cgst: 18,
            sgst: 18,
            igst: 0,
            taxAmount: 36,
            finalAmount: 236,
          },
        ],
        subtotal: 200,
        itemDiscount: 0,
        billDiscount: 0,
        taxableAmount: 200,
        cgst: 18,
        sgst: 18,
        igst: 0,
        totalTax: 36,
        grandTotal: 236,
        amountPaid: 236,
        balanceDue: 0,
        changeGiven: 0,
        paymentStatus: "PAID",
        saleStatus: "COMPLETED",
        invoiceType: "TAX_INVOICE",
        supplyType: "INTRA",
        pricesIncludeGst: false,
        notes: "PHASE7_TEST",
        invoiceSnapshot: snapshot,
        createdAt: now,
        updatedAt: now,
      });
      const soapSale = await Sale.create({
        businessId: business._id,
        storeId: store._id,
        saleNumber: `S2${stamp}`.slice(0, 40),
        invoiceNumber: `I2${stamp}`.slice(0, 40),
        idempotencyKey: `p7-soap-${stamp}`,
        items: [
          {
            product: soap._id,
            productName: "Soap",
            sku: "SOAP",
            barcode: "",
            quantity: 1,
            unit: "piece",
            unitPrice: 50,
            discount: 0,
            billDiscountShare: 0,
            hsn: "",
            taxRate: 0,
            taxableAmount: 50,
            cgst: 0,
            sgst: 0,
            igst: 0,
            taxAmount: 0,
            finalAmount: 50,
          },
        ],
        subtotal: 50,
        itemDiscount: 0,
        billDiscount: 0,
        taxableAmount: 50,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0,
        grandTotal: 50,
        amountPaid: 20,
        balanceDue: 30,
        changeGiven: 0,
        paymentStatus: "PARTIAL",
        saleStatus: "COMPLETED",
        invoiceType: "BILL_OF_SUPPLY",
        supplyType: "INTRA",
        pricesIncludeGst: false,
        notes: "PHASE7_TEST",
        invoiceSnapshot: snapshot,
        createdAt: now,
        updatedAt: now,
      });
      await Sale.create({
        businessId: business._id,
        storeId: otherStore._id,
        saleNumber: `S3${stamp}`.slice(0, 40),
        invoiceNumber: `I3${stamp}`.slice(0, 40),
        idempotencyKey: `p7-store-${stamp}`,
        items: [
          {
            product: rice._id,
            productName: "Rice",
            sku: "RICE",
            quantity: 1,
            unit: "piece",
            unitPrice: 9999,
            discount: 0,
            billDiscountShare: 0,
            hsn: "",
            taxRate: 0,
            taxableAmount: 9999,
            cgst: 0,
            sgst: 0,
            igst: 0,
            taxAmount: 0,
            finalAmount: 9999,
          },
        ],
        subtotal: 9999,
        itemDiscount: 0,
        billDiscount: 0,
        taxableAmount: 9999,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0,
        grandTotal: 9999,
        amountPaid: 9999,
        balanceDue: 0,
        changeGiven: 0,
        paymentStatus: "PAID",
        saleStatus: "COMPLETED",
        invoiceType: "BILL_OF_SUPPLY",
        supplyType: "INTRA",
        pricesIncludeGst: false,
        notes: "PHASE7_TEST",
        invoiceSnapshot: snapshot,
        createdAt: now,
        updatedAt: now,
      });
      await Sale.create({
        businessId: other._id,
        storeId: otherBusinessStore._id,
        saleNumber: `S4${stamp}`.slice(0, 40),
        invoiceNumber: `I4${stamp}`.slice(0, 40),
        idempotencyKey: `p7-other-${stamp}`,
        items: [
          {
            product: rice._id,
            productName: "Rice",
            sku: "RICE",
            quantity: 1,
            unit: "piece",
            unitPrice: 8888,
            discount: 0,
            billDiscountShare: 0,
            hsn: "",
            taxRate: 0,
            taxableAmount: 8888,
            cgst: 0,
            sgst: 0,
            igst: 0,
            taxAmount: 0,
            finalAmount: 8888,
          },
        ],
        subtotal: 8888,
        itemDiscount: 0,
        billDiscount: 0,
        taxableAmount: 8888,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0,
        grandTotal: 8888,
        amountPaid: 8888,
        balanceDue: 0,
        changeGiven: 0,
        paymentStatus: "PAID",
        saleStatus: "COMPLETED",
        invoiceType: "BILL_OF_SUPPLY",
        supplyType: "INTRA",
        pricesIncludeGst: false,
        notes: "PHASE7_TEST",
        invoiceSnapshot: snapshot,
        createdAt: now,
        updatedAt: now,
      });
      await Sale.collection.insertOne({
        businessId: business._id,
        storeId: store._id,
        saleNumber: `CX${stamp}`.slice(0, 40),
        invoiceNumber: `CX${stamp}`.slice(0, 40),
        idempotencyKey: `p7-cancel-${stamp}`,
        items: [],
        subtotal: 7777,
        itemDiscount: 0,
        billDiscount: 0,
        taxableAmount: 7777,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0,
        grandTotal: 7777,
        amountPaid: 0,
        balanceDue: 7777,
        changeGiven: 0,
        paymentStatus: "UNPAID",
        saleStatus: "CANCELLED",
        invoiceType: "BILL_OF_SUPPLY",
        supplyType: "INTRA",
        pricesIncludeGst: false,
        notes: "PHASE7_TEST",
        invoiceSnapshot: snapshot,
        createdAt: now,
        updatedAt: now,
      });

      await Payment.create({
        businessId: business._id,
        storeId: store._id,
        sale: riceSale._id,
        sequence: 1,
        paymentMethod: "CASH",
        amount: 236,
        tenderedAmount: 236,
        changeGiven: 0,
        status: "CONFIRMED",
        verification: "NOT_APPLICABLE",
        createdAt: now,
        updatedAt: now,
      });
      await Payment.create({
        businessId: business._id,
        storeId: store._id,
        sale: soapSale._id,
        sequence: 1,
        paymentMethod: "UPI",
        amount: 20,
        tenderedAmount: 20,
        changeGiven: 0,
        status: "MANUALLY_CONFIRMED",
        verification: "MANUAL",
        createdAt: now,
        updatedAt: now,
      });
      await Payment.create({
        businessId: business._id,
        storeId: store._id,
        sale: soapSale._id,
        sequence: 2,
        paymentMethod: "CREDIT",
        amount: 30,
        tenderedAmount: 0,
        changeGiven: 0,
        status: "CREDIT",
        verification: "NOT_APPLICABLE",
        createdAt: now,
        updatedAt: now,
      });

      const line = {
        product: rice._id,
        productName: "Rice",
        sku: "RICE",
        productNameSnapshot: "Rice",
        skuSnapshot: "RICE",
        quantity: 10,
        purchasePrice: 40,
        taxRate: 0,
        discount: 0,
        taxAmount: 0,
        total: 400,
      };
      await Purchase.create({
        businessId: business._id,
        storeId: store._id,
        purchaseNumber: `PR${stamp}`.slice(0, 40),
        supplierName: "Acme",
        items: [line],
        subtotal: 400,
        discount: 0,
        tax: 0,
        total: 400,
        status: "RECEIVED",
        amountPaid: 0,
        balanceDue: 400,
        paymentStatus: "UNPAID",
        receivedAt: now,
        purchaseDate: now,
        notes: "PHASE7_TEST",
      });
      await Purchase.create({
        businessId: business._id,
        storeId: store._id,
        purchaseNumber: `PD${stamp}`.slice(0, 40),
        supplierName: "Acme",
        items: [{ ...line, quantity: 1, total: 12345, purchasePrice: 12345 }],
        subtotal: 12345,
        discount: 0,
        tax: 0,
        total: 12345,
        status: "DRAFT",
        amountPaid: 0,
        balanceDue: 12345,
        paymentStatus: "UNPAID",
        notes: "PHASE7_TEST",
      });
      await Purchase.create({
        businessId: business._id,
        storeId: store._id,
        purchaseNumber: `PC${stamp}`.slice(0, 40),
        supplierName: "Acme",
        items: [{ ...line, quantity: 1, total: 50, purchasePrice: 50 }],
        subtotal: 50,
        discount: 0,
        tax: 0,
        total: 50,
        status: "CANCELLED",
        amountPaid: 0,
        balanceDue: 50,
        paymentStatus: "UNPAID",
        notes: "PHASE7_TEST",
      });
      await SupplierPayment.create({
        businessId: business._id,
        supplierId: new Types.ObjectId(),
        paymentNumber: `SP${stamp}`.slice(0, 40),
        amount: 75,
        paymentMethod: "CASH",
        paymentDate: now,
        notes: "PHASE7_TEST",
      });

      const query = parseAnalyticsQuery(new URLSearchParams({ preset: "last_30_days" }), now);
      const scope = { businessId: business._id, storeId: store._id };
      const overview = await getOverview(scope, query);
      const profit = await getProfitLoss(scope, query);
      const payments = await getPayments(scope, query);
      const purchases = await getPurchases(scope, query);

      assert.equal(overview.kpis.revenue.current, 286);
      assert.equal(overview.kpis.netSales.current, 250);
      assert.equal(overview.kpis.collected.current, 256);
      assert.equal(overview.kpis.bills.current, 2);
      assert.equal(overview.kpis.unitsSold.current, 3);
      assert.equal(overview.kpis.purchases.current, 400);
      assert.equal(overview.kpis.payables.current, 250);
      assert.equal(overview.kpis.inventoryValue.current, 105);
      assert.equal(overview.valuationMethod, "catalog_purchase_price");
      assert.equal(payments.creditOutstanding, 30);
      assert.equal(payments.methods.find((method) => method.method === "CREDIT"), undefined);
      assert.equal(profit.gst, 36);
      assert.equal(profit.netSales, 250);
      assert.equal(profit.costStatus, "partial");
      assert.equal(profit.cogs, 80);
      assert.equal(profit.grossProfit.current, 120);
      assert.equal(profit.grossMargin.current, 60);
      assert.equal(profit.netProfit, null);
      assert.equal(profit.expensesStatus, "not_configured");
      assert.equal(profit.uncoveredNetSales, 50);
      assert.equal(purchases.supplierPaymentsTotal, 75);
      assert.equal(overview.kpis.revenue.percent, null);

      const categories = await getCategories(scope, query);
      assert.equal(categories.categories[0]?.name, "Grocery");
      assert.equal(categories.categories[0]?.revenue, 286);
      const inventory = await getInventory(scope, query);
      assert.equal(inventory.valuation.amount, 105);
      assert.equal(inventory.turnover.ratio, 0.23);
      const products = await getProductPerformance(scope, {
        ...query,
        view: "top_profit",
        page: 1,
        limit: 10,
      });
      assert.equal(products.rows[0]?.name, "Rice");
      assert.equal(products.rows[0]?.grossProfit, 120);
      assert.equal(products.rows.some((row) => row.name === "Soap"), false);
      const revenue = await getRevenue(scope, query);
      assert.ok(revenue.points.length > 0);
      assert.equal(
        revenue.points.reduce((sum, point) => sum + (point.current ?? 0), 0),
        286,
      );
    } finally {
      if (businessIds.length > 0) {
        const scoped = { businessId: { $in: businessIds } };
        await Promise.all([
          Sale.collection.deleteMany(scoped),
          Payment.collection.deleteMany(scoped),
          Purchase.deleteMany(scoped),
          SupplierPayment.collection.deleteMany(scoped),
          Supplier.deleteMany(scoped),
          Product.deleteMany(scoped),
          Category.deleteMany(scoped),
          Store.deleteMany(scoped),
          Business.deleteMany({ _id: { $in: businessIds } }),
        ]);
      }
    }
  });
});
