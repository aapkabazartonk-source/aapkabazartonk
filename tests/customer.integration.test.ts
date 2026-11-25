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

describe("customers module integration", { concurrency: 1 }, () => {
  it("covers CRUD, duplicate phone, POS linkage, stats, and soft delete", async () => {
    const { connectToDatabase } = await import("../src/lib/db.ts");
    await connectToDatabase();

    const { Business } = await import("../src/models/Business.ts");
    const { Store } = await import("../src/models/Store.ts");
    const { Category } = await import("../src/models/Category.ts");
    const { Product } = await import("../src/models/Product.ts");
    const { Customer } = await import("../src/models/Customer.ts");
    const { Sale } = await import("../src/models/Sale.ts");
    const { Payment } = await import("../src/models/Payment.ts");
    const {
      createCustomer,
      updateCustomer,
      deleteCustomer,
      listCustomers,
      getCustomerDetail,
      getCustomerDashboardStats,
      searchCustomerOptions,
    } = await import("../src/lib/customer-service.ts");
    const { CustomerError } = await import("../src/lib/customer-error.ts");
    const billing = await import("../src/lib/billing-service.ts");
    const { checkoutSchema } = await import("../src/lib/validators/billing.ts");

    await Promise.all([Customer.syncIndexes(), Sale.syncIndexes()]);

    const business = await Business.findOne({ isActive: true });
    assert.ok(business, "A business is required for customer tests.");
    const store = await Store.findOne({
      businessId: business._id,
      isDefault: true,
    });
    assert.ok(store);
    const category = await Category.findOne({ businessId: business._id });
    assert.ok(category, "Create a category before running customer tests.");

    const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const scope = {
      businessId: business._id,
      storeId: store._id,
      performedBy: null as Types.ObjectId | null,
    };

    const createdIds = {
      customers: [] as Types.ObjectId[],
      products: [] as Types.ObjectId[],
      sales: [] as Types.ObjectId[],
      payments: [] as Types.ObjectId[],
      businesses: [] as Types.ObjectId[],
      stores: [] as Types.ObjectId[],
    };

    try {
      const customer = await createCustomer({
        scope,
        data: {
          name: `Cust ${stamp}`,
          phone: `98${stamp.slice(-8).padStart(8, "0")}`,
          email: `cust-${stamp}@example.com`,
          address: "12 Market Road",
          city: "Tonk",
          state: "Rajasthan",
          pincode: "304001",
          gstin: "",
          customerType: "INDIVIDUAL",
          isActive: true,
        },
      });
      createdIds.customers.push(customer._id);
      assert.equal(customer.stateCode, "08");

      const updated = await updateCustomer({
        customerId: String(customer._id),
        scope,
        data: {
          name: `Cust Edited ${stamp}`,
          customerType: "BUSINESS",
        },
      });
      assert.equal(updated.name, `Cust Edited ${stamp}`);
      assert.equal(updated.customerType, "BUSINESS");

      const byName = await searchCustomerOptions({
        businessId: business._id,
        search: "Edited",
      });
      assert.ok(byName.some((row) => row._id === String(customer._id)));

      const byPhone = await searchCustomerOptions({
        businessId: business._id,
        search: customer.phone.slice(-4),
      });
      assert.ok(byPhone.some((row) => row._id === String(customer._id)));

      await assert.rejects(
        () =>
          createCustomer({
            scope,
            data: {
              name: `Dup ${stamp}`,
              phone: customer.phone,
              customerType: "INDIVIDUAL",
            },
          }),
        (error: unknown) =>
          error instanceof CustomerError && error.code === "DUPLICATE_PHONE",
      );

      const walkInParsed = checkoutSchema.parse({
        idempotencyKey: `walkin-${stamp}`,
        customerId: null,
        notes: "",
        billDiscount: 0,
        allowCredit: false,
        settle: true,
        items: [{ productId: new Types.ObjectId().toString(), quantity: 1, discount: 0 }],
        payments: [{ method: "CASH", amount: 10 }],
      });
      assert.equal(walkInParsed.customerId, null);

      const withCustomerParsed = checkoutSchema.parse({
        idempotencyKey: `with-cust-${stamp}`,
        customerId: String(customer._id),
        notes: "",
        billDiscount: 0,
        allowCredit: false,
        settle: true,
        items: [{ productId: new Types.ObjectId().toString(), quantity: 1, discount: 0 }],
        payments: [{ method: "CASH", amount: 10 }],
      });
      assert.equal(withCustomerParsed.customerId, String(customer._id));

      const product = await Product.create({
        businessId: business._id,
        storeId: store._id,
        name: `Customer Test Product ${stamp}`,
        sku: `CUS-SKU-${stamp}`.toUpperCase(),
        category: category._id,
        unit: "piece",
        purchasePrice: 40,
        sellingPrice: 100,
        gstRate: 0,
        currentStock: 20,
        minStockLevel: 0,
        isActive: true,
      });
      createdIds.products.push(product._id);

      const walkInSale = await billing.checkoutSale({
        scope,
        data: {
          idempotencyKey: `cus-walk-${stamp}`,
          customerId: null,
          notes: "CUSTOMER_TEST",
          billDiscount: 0,
          allowCredit: false,
          settle: true,
          heldCartId: null,
          items: [{ productId: String(product._id), quantity: 1, discount: 0 }],
          payments: [{ method: "CASH", amount: 100 }],
        },
      });
      createdIds.sales.push(walkInSale.sale._id);
      assert.equal(walkInSale.sale.customer, null);
      assert.equal(
        walkInSale.sale.invoiceSnapshot.customerName,
        "Walk-in Customer",
      );

      const linkedSale = await billing.checkoutSale({
        scope,
        data: {
          idempotencyKey: `cus-link-${stamp}`,
          customerId: String(customer._id),
          notes: "CUSTOMER_TEST",
          billDiscount: 0,
          allowCredit: false,
          settle: true,
          heldCartId: null,
          items: [{ productId: String(product._id), quantity: 2, discount: 0 }],
          payments: [{ method: "CASH", amount: 200 }],
        },
      });
      createdIds.sales.push(linkedSale.sale._id);
      assert.equal(String(linkedSale.sale.customer), String(customer._id));
      assert.equal(
        linkedSale.sale.invoiceSnapshot.customerName,
        `Cust Edited ${stamp}`,
      );
      assert.equal(
        linkedSale.sale.invoiceSnapshot.customerPhone,
        customer.phone,
      );

      const quick = await createCustomer({
        scope,
        data: {
          name: `POS Quick ${stamp}`,
          phone: `97${stamp.slice(-8).padStart(8, "1")}`,
          email: "",
          customerType: "INDIVIDUAL",
        },
      });
      createdIds.customers.push(quick._id);

      const quickSale = await billing.checkoutSale({
        scope,
        data: {
          idempotencyKey: `cus-quick-${stamp}`,
          customerId: String(quick._id),
          notes: "CUSTOMER_TEST",
          billDiscount: 0,
          allowCredit: false,
          settle: true,
          heldCartId: null,
          items: [{ productId: String(product._id), quantity: 1, discount: 0 }],
          payments: [{ method: "CASH", amount: 100 }],
        },
      });
      createdIds.sales.push(quickSale.sale._id);

      const detail = await getCustomerDetail({
        customerId: String(customer._id),
        businessId: business._id,
      });
      assert.equal(detail.stats.totalPurchases, 1);
      assert.equal(detail.stats.totalAmountSpent, 200);
      assert.equal(detail.stats.averagePurchaseValue, 200);
      assert.equal(detail.purchases.data.length, 1);
      assert.equal(detail.purchases.data[0].invoiceNumber, linkedSale.sale.invoiceNumber);

      // Draft/non-completed statuses are not in SALE_STATUSES; ensure COMPLETED-only filter.
      const listed = await listCustomers({
        businessId: business._id,
        filter: { isActive: true, deletedAt: null },
        page: 1,
        limit: 50,
        skip: 0,
        sortField: "createdAt",
        order: -1,
      });
      const listedRow = listed.data.find((row) => row._id === String(customer._id));
      assert.ok(listedRow);
      assert.equal(listedRow.totalPurchases, 1);
      assert.equal(listedRow.totalAmountSpent, 200);

      const stats = await getCustomerDashboardStats(business._id);
      assert.ok(stats.totalCustomers >= 2);
      assert.ok(stats.newCustomersThisMonth >= 2);

      const soft = await deleteCustomer({
        customerId: String(customer._id),
        scope,
      });
      assert.equal(soft.softDeleted, true);

      const afterDelete = await Sale.findById(linkedSale.sale._id).lean();
      assert.ok(afterDelete);
      assert.equal(
        afterDelete.invoiceSnapshot.customerName,
        `Cust Edited ${stamp}`,
      );
      assert.equal(String(afterDelete.customer), String(customer._id));

      const inactiveDetail = await getCustomerDetail({
        customerId: String(customer._id),
        businessId: business._id,
      });
      assert.equal(inactiveDetail.stats.totalPurchases, 1);
      assert.equal(inactiveDetail.isActive, false);

      const otherBusiness = await Business.create({
        name: `Other Cust Biz ${stamp}`,
        code: `OC-${stamp}`.toUpperCase(),
        isActive: true,
      });
      createdIds.businesses.push(otherBusiness._id);
      const otherStore = await Store.create({
        businessId: otherBusiness._id,
        name: "Other Store",
        code: "MAIN",
        isDefault: true,
        isActive: true,
      });
      createdIds.stores.push(otherStore._id);

      await assert.rejects(
        () =>
          getCustomerDetail({
            customerId: String(customer._id),
            businessId: otherBusiness._id,
          }),
        (error: unknown) =>
          error instanceof CustomerError && error.status === 404,
      );

      const noHistory = await createCustomer({
        scope,
        data: {
          name: `No History ${stamp}`,
          phone: `96${stamp.slice(-8).padStart(8, "2")}`,
          customerType: "INDIVIDUAL",
        },
      });
      createdIds.customers.push(noHistory._id);
      const hard = await deleteCustomer({
        customerId: String(noHistory._id),
        scope,
      });
      assert.equal(hard.softDeleted, false);
      const gone = await Customer.findById(noHistory._id);
      assert.equal(gone, null);
      createdIds.customers = createdIds.customers.filter(
        (id) => String(id) !== String(noHistory._id),
      );
    } finally {
      if (createdIds.sales.length) {
        await Sale.collection.deleteMany({ _id: { $in: createdIds.sales } });
        await Payment.collection.deleteMany({
          sale: { $in: createdIds.sales },
        });
      }
      if (createdIds.products.length) {
        await Product.deleteMany({ _id: { $in: createdIds.products } });
      }
      if (createdIds.customers.length) {
        await Customer.deleteMany({ _id: { $in: createdIds.customers } });
      }
      if (createdIds.stores.length) {
        await Store.deleteMany({ _id: { $in: createdIds.stores } });
      }
      if (createdIds.businesses.length) {
        await Business.deleteMany({ _id: { $in: createdIds.businesses } });
      }
    }
  });

  after(async () => {
    await mongoose.disconnect();
  });
});
