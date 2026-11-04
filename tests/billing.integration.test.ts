import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it, after } from "node:test";
import mongoose, { Types } from "mongoose";

function loadEnv() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnv();

type CheckoutModule = typeof import("../src/lib/billing-service.ts");
type Models = {
  Business: typeof import("../src/models/Business.ts").Business;
  Store: typeof import("../src/models/Store.ts").Store;
  Category: typeof import("../src/models/Category.ts").Category;
  Product: typeof import("../src/models/Product.ts").Product;
  Customer: typeof import("../src/models/Customer.ts").Customer;
  Sale: typeof import("../src/models/Sale.ts").Sale;
  Payment: typeof import("../src/models/Payment.ts").Payment;
  HeldCart: typeof import("../src/models/HeldCart.ts").HeldCart;
  InventoryLog: typeof import("../src/models/InventoryLog.ts").InventoryLog;
};

describe("billing integration", { concurrency: 1 }, () => {
  it("checks out sales atomically and keeps tenants apart", async () => {
    const { connectToDatabase } = await import("../src/lib/db.ts");
    await connectToDatabase();
    const billing = await import("../src/lib/billing-service.ts");
    const { requireTenant, TenantError } = await import("../src/lib/tenant.ts");
    const { Business } = await import("../src/models/Business.ts");
    const { Store } = await import("../src/models/Store.ts");
    const { Category } = await import("../src/models/Category.ts");
    const { Product } = await import("../src/models/Product.ts");
    const { Customer } = await import("../src/models/Customer.ts");
    const { Sale } = await import("../src/models/Sale.ts");
    const { Payment } = await import("../src/models/Payment.ts");
    const { HeldCart } = await import("../src/models/HeldCart.ts");
    const { InventoryLog } = await import("../src/models/InventoryLog.ts");
    const models: Models = {
      Business,
      Store,
      Category,
      Product,
      Customer,
      Sale,
      Payment,
      HeldCart,
      InventoryLog,
    };

    await Promise.all([
      models.Sale.syncIndexes(),
      models.Payment.syncIndexes(),
      models.HeldCart.syncIndexes(),
      models.Product.syncIndexes(),
    ]);

    const business = await models.Business.findOne({ isActive: true });
    assert.ok(business, "A business is required for billing tests.");
    const store = await models.Store.findOne({ businessId: business._id, isDefault: true });
    assert.ok(store);
    const category = await models.Category.findOne({ businessId: business._id });
    assert.ok(category, "Create a category before running billing tests.");

    const original = {
      isGstRegistered: business.isGstRegistered,
      gstin: business.gstin,
      stateCode: business.stateCode,
      state: business.state,
      pricesIncludeGst: business.pricesIncludeGst,
    };
    const productIds: Types.ObjectId[] = [];
    const customerIds: Types.ObjectId[] = [];
    const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    let otherBusinessId: Types.ObjectId | null = null;

    const scope = {
      businessId: business._id,
      storeId: store._id,
      performedBy: null,
    };

    async function makeProduct(params: {
      price: number;
      stock: number;
      gstRate?: number;
      name?: string;
    }) {
      const created = await models.Product.create({
        businessId: business._id,
        storeId: store!._id,
        name: params.name ?? `Phase4 ${stamp}`,
        sku: `P4${stamp}${productIds.length}`,
        barcode: `P4B${stamp}${productIds.length}`,
        description: "PHASE4_TEST",
        category: category!._id,
        subcategory: null,
        purchasePrice: 1,
        sellingPrice: params.price,
        currentStock: params.stock,
        minStockLevel: 0,
        unit: "piece",
        hsn: "1006",
        gstRate: params.gstRate ?? 0,
        images: [],
        isActive: true,
      });
      productIds.push(created._id);
      return created;
    }

    async function sell(
      productId: string,
      quantity: number,
      payments: CheckoutModule extends never ? never : Parameters<CheckoutModule["checkoutSale"]>[0]["data"]["payments"],
      extra: Record<string, unknown> = {},
    ) {
      return billing.checkoutSale({
        scope,
        data: {
          idempotencyKey: `p4-${stamp}-${Math.random().toString(36).slice(2)}`,
          customerId: null,
          notes: "PHASE4_TEST",
          billDiscount: 0,
          allowCredit: false,
          settle: true,
          heldCartId: null,
          items: [{ productId, quantity, discount: 0 }],
          payments,
          ...extra,
        },
      });
    }

    try {
      await models.Business.updateOne(
        { _id: business._id },
        { $set: { isGstRegistered: false, gstin: "", pricesIncludeGst: false, stateCode: "", state: "" } },
      );

      const cashProduct = await makeProduct({ price: 80, stock: 10 });
      const cashSale = await sell(cashProduct._id.toString(), 1, [{ method: "CASH", amount: 100 }]);
      assert.equal(cashSale.replayed, false);
      assert.equal(cashSale.sale.grandTotal, 80);
      assert.equal(cashSale.sale.amountPaid, 80);
      assert.equal(cashSale.sale.changeGiven, 20);
      assert.equal(cashSale.sale.invoiceType, "BILL_OF_SUPPLY");
      assert.equal(cashSale.sale.totalTax, 0);
      assert.equal(cashSale.payments[0].paymentMethod, "CASH");
      const afterCash = await models.Product.findById(cashProduct._id);
      assert.equal(afterCash?.currentStock, 9);

      const replay = await billing.checkoutSale({
        scope,
        data: {
          idempotencyKey: cashSale.sale.idempotencyKey,
          customerId: null,
          notes: "PHASE4_TEST",
          billDiscount: 0,
          allowCredit: false,
          settle: true,
          heldCartId: null,
          items: [{ productId: cashProduct._id.toString(), quantity: 1, discount: 0 }],
          payments: [{ method: "CASH", amount: 80 }],
        },
      });
      assert.equal(replay.replayed, true);
      assert.equal(replay.sale.invoiceNumber, cashSale.sale.invoiceNumber);
      const afterReplay = await models.Product.findById(cashProduct._id);
      assert.equal(afterReplay?.currentStock, 9);
      const paymentCount = await models.Payment.countDocuments({ sale: cashSale.sale._id });
      assert.equal(paymentCount, 1);

      const upi = await sell(cashProduct._id.toString(), 1, [
        { method: "UPI", amount: 80, referenceNumber: "UTR-TEST" },
      ]);
      assert.equal(upi.payments[0].status, "MANUALLY_CONFIRMED");
      assert.equal(upi.payments[0].verification, "MANUAL");

      const card = await sell(cashProduct._id.toString(), 1, [{ method: "CARD", amount: 80 }]);
      assert.equal(card.payments[0].paymentMethod, "CARD");
      assert.equal(card.payments[0].verification, "MANUAL");

      const split = await sell(cashProduct._id.toString(), 1, [
        { method: "UPI", amount: 30 },
        { method: "CASH", amount: 70 },
      ]);
      assert.equal(split.sale.amountPaid, 80);
      assert.equal(split.sale.changeGiven, 20);
      assert.equal(split.payments.filter((payment) => payment.paymentMethod !== "CREDIT").length, 2);

      const partial = await sell(
        cashProduct._id.toString(),
        1,
        [{ method: "BANK_TRANSFER", amount: 25, referenceNumber: "NEFT1" }],
        { allowCredit: true },
      );
      assert.equal(partial.sale.paymentStatus, "PARTIAL");
      assert.equal(partial.sale.amountPaid, 25);
      assert.equal(partial.sale.balanceDue, 55);
      assert.ok(partial.payments.some((payment) => payment.paymentMethod === "CREDIT"));

      await assert.rejects(
        () => sell(cashProduct._id.toString(), 100, [{ method: "CASH", amount: 1 }]),
        (error: unknown) => {
          assert.equal((error as { code?: string }).code, "INSUFFICIENT_STOCK");
          return true;
        },
      );
      const afterReject = await models.Product.findById(cashProduct._id);
      assert.equal(afterReject?.currentStock, 5);

      const log = await models.InventoryLog.findOne({
        businessId: business._id,
        product: cashProduct._id,
        referenceId: cashSale.sale._id,
        movementType: "SALE",
      });
      assert.ok(log);
      assert.equal(log?.previousStock, 10);
      assert.equal(log?.newStock, 9);
      assert.equal(log?.referenceType, "SALE");

      const second = await sell(cashProduct._id.toString(), 1, [{ method: "CASH", amount: 80 }]);
      assert.notEqual(second.sale.invoiceNumber, cashSale.sale.invoiceNumber);
      assert.notEqual(second.sale.saleNumber, cashSale.sale.saleNumber);

      const raced = await makeProduct({ price: 10, stock: 5, name: "Race item" });
      const attempts = await Promise.allSettled(
        Array.from({ length: 8 }, () =>
          sell(raced._id.toString(), 1, [{ method: "CASH", amount: 10 }]),
        ),
      );
      const sold = attempts.filter((attempt) => attempt.status === "fulfilled").length;
      const racedAfter = await models.Product.findById(raced._id);
      assert.ok((racedAfter?.currentStock ?? -1) >= 0);
      assert.equal((racedAfter?.currentStock ?? 0) + sold, 5);

      await models.Business.updateOne(
        { _id: business._id },
        {
          $set: {
            isGstRegistered: true,
            gstin: "27AAPFU0939F1ZV",
            stateCode: "27",
            state: "Maharashtra",
            pricesIncludeGst: false,
          },
        },
      );
      const taxed = await makeProduct({ price: 100, stock: 5, gstRate: 18, name: "Taxed item" });
      const taxSale = await sell(taxed._id.toString(), 1, [{ method: "CASH", amount: 118 }]);
      assert.equal(taxSale.sale.invoiceType, "TAX_INVOICE");
      assert.equal(taxSale.sale.totalTax, 18);
      assert.equal(taxSale.sale.cgst, 9);
      assert.equal(taxSale.sale.sgst, 9);
      assert.equal(taxSale.sale.grandTotal, 118);
      assert.equal(taxSale.sale.items[0].taxRate, 18);
      assert.equal(taxSale.sale.items[0].hsn, "1006");

      await models.Product.updateOne({ _id: taxed._id }, { $set: { gstRate: 5, sellingPrice: 1 } });
      const reread = await models.Sale.findById(taxSale.sale._id);
      assert.equal(reread?.items[0].taxRate, 18);
      assert.equal(reread?.grandTotal, 118);

      await models.Business.updateOne(
        { _id: business._id },
        { $set: { pricesIncludeGst: true } },
      );
      const included = await makeProduct({ price: 118, stock: 2, gstRate: 18, name: "Inclusive item" });
      const includedSale = await sell(included._id.toString(), 1, [{ method: "CASH", amount: 118 }]);
      assert.equal(includedSale.sale.taxableAmount, 100);
      assert.equal(includedSale.sale.totalTax, 18);
      assert.equal(includedSale.sale.grandTotal, 118);

      await models.Business.updateOne(
        { _id: business._id },
        { $set: { pricesIncludeGst: false } },
      );
      const interstate = await makeProduct({ price: 100, stock: 4, gstRate: 18, name: "Interstate item" });
      const customer = await models.Customer.create({
        businessId: business._id,
        name: `Phase4 ${stamp}`,
        phone: "9000000000",
        stateCode: "29",
        gstin: "",
        isActive: true,
      });
      customerIds.push(customer._id);
      const igstSale = await sell(
        interstate._id.toString(),
        1,
        [{ method: "CASH", amount: 118 }],
        { customerId: customer._id.toString() },
      );
      assert.equal(igstSale.sale.supplyType, "INTER");
      assert.equal(igstSale.sale.igst, 18);
      assert.equal(igstSale.sale.cgst, 0);

      const discounted = await billing.checkoutSale({
        scope,
        data: {
          idempotencyKey: `disc-${stamp}`,
          customerId: null,
          notes: "PHASE4_TEST",
          billDiscount: 10,
          allowCredit: false,
          settle: true,
          heldCartId: null,
          items: [{ productId: interstate._id.toString(), quantity: 1, discount: 10 }],
          payments: [{ method: "CASH", amount: 200 }],
        },
      });
      assert.equal(discounted.sale.itemDiscount, 10);
      assert.equal(discounted.sale.billDiscount, 10);
      assert.ok(discounted.sale.grandTotal < 118);

      const heldProduct = await makeProduct({ price: 15, stock: 3, name: "Held item" });
      const held = await billing.holdCart({
        scope,
        data: {
          customerId: null,
          notes: "PHASE4_TEST",
          billDiscount: 0,
          heldCartId: null,
          items: [{ productId: heldProduct._id.toString(), quantity: 1, discount: 0 }],
        },
      });
      const resumed = await billing.resumeHeldCart(scope, held._id.toString());
      assert.equal(resumed.items[0].productId, heldProduct._id.toString());
      const heldSale = await billing.checkoutSale({
        scope,
        data: {
          idempotencyKey: `held-${stamp}`,
          customerId: null,
          notes: "PHASE4_TEST",
          billDiscount: 0,
          allowCredit: false,
          settle: true,
          heldCartId: held._id.toString(),
          items: [{ productId: heldProduct._id.toString(), quantity: 1, discount: 0 }],
          payments: [{ method: "CASH", amount: 15 }],
        },
      });
      const heldAfter = await models.HeldCart.findById(held._id);
      assert.equal(heldAfter?.status, "RESUMED");
      await assert.rejects(
        () =>
          billing.checkoutSale({
            scope,
            data: {
              idempotencyKey: `held-again-${stamp}`,
              customerId: null,
              notes: "PHASE4_TEST",
              billDiscount: 0,
              allowCredit: false,
              settle: true,
              heldCartId: held._id.toString(),
              items: [{ productId: heldProduct._id.toString(), quantity: 1, discount: 0 }],
              payments: [{ method: "CASH", amount: 15 }],
            },
          }),
        (error: unknown) => (error as { code?: string }).code === "HELD_CART_CONFLICT",
      );
      assert.equal(heldSale.sale.grandTotal, 15);

      const other = await models.Business.create({
        name: `Other ${stamp}`,
        code: `P4${stamp}`.slice(0, 40),
        legalName: "",
        gstin: "",
        isGstRegistered: false,
        isActive: false,
      });
      otherBusinessId = other._id;
      const otherStore = await models.Store.create({
        businessId: other._id,
        name: "Other store",
        code: "MAIN",
        isDefault: true,
        isActive: true,
      });
      const otherCategory = await models.Category.create({
        businessId: other._id,
        name: "Other",
        normalizedName: `other-${stamp}`,
        slug: `other-${stamp}`,
        description: "",
        image: "",
        parentCategory: null,
        isActive: true,
      });
      const otherProduct = await models.Product.create({
        businessId: other._id,
        storeId: otherStore._id,
        name: "Other product",
        sku: `OP${stamp}`,
        barcode: "",
        description: "",
        category: otherCategory._id,
        purchasePrice: 1,
        sellingPrice: 40,
        currentStock: 4,
        minStockLevel: 0,
        unit: "piece",
        hsn: "",
        gstRate: 0,
        isActive: true,
      });
      const foreign = await billing.checkoutSale({
        scope: { businessId: other._id, storeId: otherStore._id, performedBy: null },
        data: {
          idempotencyKey: `foreign-${stamp}`,
          customerId: null,
          notes: "PHASE4_TEST",
          billDiscount: 0,
          allowCredit: false,
          settle: true,
          heldCartId: null,
          items: [{ productId: otherProduct._id.toString(), quantity: 1, discount: 0 }],
          payments: [{ method: "CASH", amount: 40 }],
        },
      });
      const hidden = await billing.getSaleBundle(business._id, foreign.sale._id.toString());
      assert.equal(hidden, null);
      const visible = await billing.listSales({
        businessId: business._id,
        filter: { _id: foreign.sale._id },
        page: 1,
        limit: 10,
        skip: 0,
      });
      assert.equal(visible.data.length, 0);

      await models.Business.updateOne({ _id: other._id }, { $set: { isActive: true } });
      await assert.rejects(() => requireTenant(), TenantError);
    } finally {
      await models.Business.updateOne({ _id: business._id }, { $set: original });
      if (otherBusinessId) {
        await models.Business.updateOne({ _id: otherBusinessId }, { $set: { isActive: false } });
        const otherProducts = await models.Product.find({ businessId: otherBusinessId }).select("_id");
        const otherProductIds = otherProducts.map((product) => product._id);
        await models.Sale.collection.deleteMany({ businessId: otherBusinessId });
        await models.Payment.collection.deleteMany({ businessId: otherBusinessId });
        await models.InventoryLog.collection.deleteMany({ product: { $in: otherProductIds } });
        await models.Product.deleteMany({ businessId: otherBusinessId });
        await models.Category.deleteMany({ businessId: otherBusinessId });
        await models.Store.deleteMany({ businessId: otherBusinessId });
        await models.Business.deleteOne({ _id: otherBusinessId });
      }
      const sales = await models.Sale.find({
        businessId: business._id,
        "items.product": { $in: productIds },
      }).select("_id");
      const saleIds = sales.map((sale) => sale._id);
      await models.Payment.collection.deleteMany({ sale: { $in: saleIds } });
      await models.Sale.collection.deleteMany({ _id: { $in: saleIds } });
      await models.InventoryLog.collection.deleteMany({ product: { $in: productIds } });
      await models.HeldCart.deleteMany({
        businessId: business._id,
        notes: "PHASE4_TEST",
      });
      await models.Product.deleteMany({ _id: { $in: productIds } });
      await models.Customer.deleteMany({ _id: { $in: customerIds } });
    }
  });

  after(async () => {
    await mongoose.disconnect();
  });
});
