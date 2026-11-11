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

describe("supplier management integration", { concurrency: 1 }, () => {
  it("covers supplier CRUD, payables, payments, ledger, and tenant isolation", async () => {
    const { connectToDatabase } = await import("../src/lib/db.ts");
    await connectToDatabase();

    const { Business } = await import("../src/models/Business.ts");
    const { Store } = await import("../src/models/Store.ts");
    const { Category } = await import("../src/models/Category.ts");
    const { Product } = await import("../src/models/Product.ts");
    const { Supplier } = await import("../src/models/Supplier.ts");
    const { Purchase } = await import("../src/models/Purchase.ts");
    const { SupplierPayment } = await import("../src/models/SupplierPayment.ts");
    const { SupplierLedgerEntry } = await import(
      "../src/models/SupplierLedgerEntry.ts"
    );
    const { createSupplier, deleteSupplier, updateSupplier, getSupplierLedger } =
      await import("../src/lib/supplier-service.ts");
    const { recordSupplierPayment } = await import(
      "../src/lib/supplier-payment-service.ts"
    );
    const {
      createPurchaseDraft,
      receivePurchase,
      cancelPurchase,
    } = await import("../src/lib/purchase-service.ts");
    const { SupplierError } = await import("../src/lib/supplier-error.ts");

    await Promise.all([
      Supplier.syncIndexes(),
      SupplierPayment.syncIndexes(),
      SupplierLedgerEntry.syncIndexes(),
      Purchase.syncIndexes(),
    ]);

    const business = await Business.findOne({ isActive: true });
    assert.ok(business, "A business is required for supplier tests.");
    const store = await Store.findOne({
      businessId: business._id,
      isDefault: true,
    });
    assert.ok(store);
    const category = await Category.findOne({ businessId: business._id });
    assert.ok(category, "Create a category before running supplier tests.");

    const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const scope = {
      businessId: business._id,
      storeId: store._id,
      performedBy: null as Types.ObjectId | null,
    };

    const product = await Product.create({
      businessId: business._id,
      storeId: store._id,
      name: `Supplier Test Product ${stamp}`,
      sku: `SUP-SKU-${stamp}`.toUpperCase(),
      category: category._id,
      unit: "piece",
      purchasePrice: 50,
      sellingPrice: 80,
      currentStock: 0,
      minStockLevel: 0,
      isActive: true,
    });

    const otherBusiness = await Business.create({
      name: `Other Biz ${stamp}`,
      code: `OB-${stamp}`.toUpperCase(),
      isActive: true,
    });
    const otherStore = await Store.create({
      businessId: otherBusiness._id,
      name: "Other Store",
      code: "MAIN",
      isDefault: true,
      isActive: true,
    });

    const createdIds = {
      suppliers: [] as Types.ObjectId[],
      purchases: [] as Types.ObjectId[],
      payments: [] as Types.ObjectId[],
      products: [product._id] as Types.ObjectId[],
      businesses: [otherBusiness._id] as Types.ObjectId[],
      stores: [otherStore._id] as Types.ObjectId[],
    };

    try {
      // 1. Supplier creation
      const supplier = await createSupplier({
        data: {
          name: `Alpha Supplier ${stamp}`,
          contactPerson: "Ravi",
          phone: "9876543210",
          email: `alpha-${stamp}@example.com`,
          gstin: "",
          address: "Tonk Road",
          city: "Jaipur",
          state: "Rajasthan",
          pincode: "302001",
          openingBalance: 200,
          notes: "Phase 5 test",
          isActive: true,
        },
        scope,
      });
      createdIds.suppliers.push(supplier._id);
      assert.equal(supplier.currentBalance, 200);
      assert.equal(supplier.openingBalance, 200);

      // 2. Supplier editing
      const edited = await updateSupplier({
        supplierId: String(supplier._id),
        data: { contactPerson: "Ravi Kumar", city: "Tonk" },
        scope,
      });
      assert.equal(edited.contactPerson, "Ravi Kumar");
      assert.equal(edited.city, "Tonk");

      // 3. Supplier search
      const searchHits = await Supplier.find({
        businessId: business._id,
        $or: [
          { name: { $regex: stamp, $options: "i" } },
          { phone: "9876543210" },
        ],
      });
      assert.ok(searchHits.some((row) => String(row._id) === String(supplier._id)));

      // 4. Delete restriction after history — first prove empty delete works on another supplier
      const disposable = await createSupplier({
        data: {
          name: `Disposable ${stamp}`,
          phone: "9123456780",
          contactPerson: "",
          email: "",
          gstin: "",
          address: "",
          city: "",
          state: "",
          pincode: "",
          openingBalance: 0,
          notes: "",
          isActive: true,
        },
        scope,
      });
      await deleteSupplier({
        supplierId: String(disposable._id),
        scope,
      });
      const gone = await Supplier.findById(disposable._id);
      assert.equal(gone, null);

      // 5 + 6. Supplier-purchase relationship + receive updates payable
      const draft = await createPurchaseDraft({
        data: {
          supplierId: String(supplier._id),
          supplierName: supplier.name,
          supplierContact: supplier.phone,
          supplierInvoiceNumber: `INV-${stamp}`,
          items: [
            {
              productId: String(product._id),
              quantity: 2,
              purchasePrice: 50,
              taxRate: 0,
              discount: 0,
            },
          ],
          discount: 0,
          notes: "",
        },
        scope,
      });
      createdIds.purchases.push(draft._id);
      assert.equal(String(draft.supplier), String(supplier._id));
      assert.equal(draft.status, "DRAFT");

      const beforeReceive = await Supplier.findById(supplier._id);
      assert.equal(beforeReceive?.currentBalance, 200);

      const received = await receivePurchase({
        purchaseId: String(draft._id),
        scope,
      });
      assert.equal(received.status, "RECEIVED");
      assert.equal(received.balanceDue, 100);
      assert.equal(received.paymentStatus, "UNPAID");

      const afterReceive = await Supplier.findById(supplier._id);
      assert.equal(afterReceive?.currentBalance, 300);

      // Draft cancel does not affect payable
      const cancelledDraft = await createPurchaseDraft({
        data: {
          supplierId: String(supplier._id),
          supplierName: supplier.name,
          supplierContact: supplier.phone,
          items: [
            {
              productId: String(product._id),
              quantity: 1,
              purchasePrice: 50,
              taxRate: 0,
              discount: 0,
            },
          ],
          discount: 0,
          notes: "",
        },
        scope,
      });
      createdIds.purchases.push(cancelledDraft._id);
      await cancelPurchase(String(cancelledDraft._id), scope);
      const afterCancel = await Supplier.findById(supplier._id);
      assert.equal(afterCancel?.currentBalance, 300);

      // 7. Partial payment
      const partial = await recordSupplierPayment({
        supplierId: String(supplier._id),
        data: {
          amount: 40,
          paymentMethod: "UPI",
          referenceNumber: `UPI-${stamp}`,
          notes: "partial",
          allowAdvance: false,
        },
        scope,
      });
      createdIds.payments.push(partial._id);
      assert.equal(partial.amount, 40);
      assert.equal(partial.unallocatedAmount, 0);

      const afterPartial = await Supplier.findById(supplier._id);
      assert.equal(afterPartial?.currentBalance, 260);

      const purchaseAfterPartial = await Purchase.findById(draft._id);
      assert.equal(purchaseAfterPartial?.amountPaid, 40);
      assert.equal(purchaseAfterPartial?.paymentStatus, "PARTIAL");

      // 8. Full remaining purchase payment (60 of the 100) + later opening still open
      const fullPurchasePay = await recordSupplierPayment({
        supplierId: String(supplier._id),
        data: {
          amount: 60,
          paymentMethod: "CASH",
          notes: "clear purchase",
          allowAdvance: false,
        },
        scope,
      });
      createdIds.payments.push(fullPurchasePay._id);
      const purchasePaid = await Purchase.findById(draft._id);
      assert.equal(purchasePaid?.paymentStatus, "PAID");
      assert.equal(purchasePaid?.balanceDue, 0);

      const afterFullPurchase = await Supplier.findById(supplier._id);
      // 260 - 60 = 200 opening still payable
      assert.equal(afterFullPurchase?.currentBalance, 200);

      // 9. Supplier advance — amount above current payable requires explicit flag
      await assert.rejects(
        () =>
          recordSupplierPayment({
            supplierId: String(supplier._id),
            data: {
              amount: 250,
              paymentMethod: "BANK_TRANSFER",
              allowAdvance: false,
              notes: "should fail",
            },
            scope,
          }),
        (error: unknown) =>
          error instanceof SupplierError && error.code === "ADVANCE_REQUIRED",
      );

      const advance = await recordSupplierPayment({
        supplierId: String(supplier._id),
        data: {
          amount: 250,
          paymentMethod: "CHEQUE",
          referenceNumber: `CHQ-${stamp}`,
          allowAdvance: true,
          notes: "pay opening + advance",
        },
        scope,
      });
      createdIds.payments.push(advance._id);
      assert.equal(advance.amount, 250);
      assert.ok(advance.unallocatedAmount >= 200);

      const afterAdvance = await Supplier.findById(supplier._id);
      // 200 payable − 250 payment = −50 advance credit
      assert.equal(afterAdvance?.currentBalance, -50);

      // 10. Duplicate payment prevention via unique ledger reference
      const ledgerForPayment = await SupplierLedgerEntry.find({
        businessId: business._id,
        entryType: "PAYMENT",
        referenceId: partial._id,
      });
      assert.equal(ledgerForPayment.length, 1);

      // 11. Supplier ledger balance
      const ledger = await getSupplierLedger({
        supplierId: String(supplier._id),
        businessId: business._id,
        page: 1,
        limit: 50,
      });
      assert.equal(ledger.outstanding, afterAdvance?.currentBalance);
      const last = ledger.data[ledger.data.length - 1];
      assert.equal(last.runningBalance, ledger.outstanding);

      // 12. Multiple payments already recorded above
      const paymentCount = await SupplierPayment.countDocuments({
        businessId: business._id,
        supplierId: supplier._id,
      });
      assert.ok(paymentCount >= 3);

      // 13. Business data isolation
      const foreign = await createSupplier({
        data: {
          name: `Foreign ${stamp}`,
          phone: "9000000001",
          contactPerson: "",
          email: "",
          gstin: "",
          address: "",
          city: "",
          state: "",
          pincode: "",
          openingBalance: 0,
          notes: "",
          isActive: true,
        },
        scope: {
          businessId: otherBusiness._id,
          storeId: otherStore._id,
          performedBy: null,
        },
      });
      createdIds.suppliers.push(foreign._id);

      const cross = await Supplier.findOne({
        _id: foreign._id,
        businessId: business._id,
      });
      assert.equal(cross, null);

      await assert.rejects(
        () =>
          recordSupplierPayment({
            supplierId: String(foreign._id),
            data: {
              amount: 10,
              paymentMethod: "CASH",
              allowAdvance: true,
            },
            scope,
          }),
        (error: unknown) =>
          error instanceof SupplierError && error.status === 404,
      );

      // 4 continued: delete blocked with history
      await assert.rejects(
        () =>
          deleteSupplier({
            supplierId: String(supplier._id),
            scope,
          }),
        (error: unknown) =>
          error instanceof SupplierError && error.code === "HAS_HISTORY",
      );

      // Inactive supplier blocked on new purchases
      await updateSupplier({
        supplierId: String(supplier._id),
        data: { isActive: false },
        scope,
      });
      await assert.rejects(
        () =>
          createPurchaseDraft({
            data: {
              supplierId: String(supplier._id),
              supplierName: supplier.name,
              supplierContact: supplier.phone,
              items: [
                {
                  productId: String(product._id),
                  quantity: 1,
                  purchasePrice: 50,
                  taxRate: 0,
                  discount: 0,
                },
              ],
              discount: 0,
              notes: "",
            },
            scope,
          }),
      );

      // 14. Legacy purchase without supplierId — stock only, no payable change
      await updateSupplier({
        supplierId: String(supplier._id),
        data: { isActive: true },
        scope,
      });
      const balanceBeforeLegacy = (
        await Supplier.findById(supplier._id)
      )?.currentBalance;

      const legacy = await createPurchaseDraft({
        data: {
          supplierId: null,
          supplierName: `Walk-in Vendor ${stamp}`,
          supplierContact: "9000111222",
          items: [
            {
              productId: String(product._id),
              quantity: 1,
              purchasePrice: 50,
              taxRate: 0,
              discount: 0,
            },
          ],
          discount: 0,
          notes: "legacy free-text",
        },
        scope,
      });
      createdIds.purchases.push(legacy._id);
      assert.equal(legacy.supplier, null);

      await receivePurchase({
        purchaseId: String(legacy._id),
        scope,
      });

      const balanceAfterLegacy = (
        await Supplier.findById(supplier._id)
      )?.currentBalance;
      assert.equal(balanceAfterLegacy, balanceBeforeLegacy);

      const legacyLedger = await SupplierLedgerEntry.findOne({
        businessId: business._id,
        referenceId: legacy._id,
      });
      assert.equal(legacyLedger, null);
    } finally {
      await Promise.all([
        SupplierPayment.collection.deleteMany({
          _id: { $in: createdIds.payments },
        }),
        SupplierLedgerEntry.collection.deleteMany({
          supplierId: { $in: createdIds.suppliers },
        }),
        Purchase.deleteMany({ _id: { $in: createdIds.purchases } }),
        Supplier.collection.deleteMany({ _id: { $in: createdIds.suppliers } }),
        Product.deleteMany({ _id: { $in: createdIds.products } }),
        Store.deleteMany({ _id: { $in: createdIds.stores } }),
        Business.deleteMany({ _id: { $in: createdIds.businesses } }),
      ]);
      await mongoose.connection.close();
    }
  });
});
