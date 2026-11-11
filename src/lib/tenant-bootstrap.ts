import { Business } from "@/models/Business";
import { BusinessSettings } from "@/models/BusinessSettings";
import { Category } from "@/models/Category";
import { Customer } from "@/models/Customer";
import { HeldCart } from "@/models/HeldCart";
import { InventoryLog } from "@/models/InventoryLog";
import { Order } from "@/models/Order";
import { Payment } from "@/models/Payment";
import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";
import { Sale } from "@/models/Sale";
import { StockAdjustment } from "@/models/StockAdjustment";
import { Store } from "@/models/Store";
import { Supplier } from "@/models/Supplier";

export const BOOTSTRAP_BUSINESS_CODE = "DEFAULT";
export const BOOTSTRAP_STORE_CODE = "MAIN";

let infrastructureReady: Promise<void> | null = null;

/** Ensures DEFAULT business/store exist and legacy rows are backfilled. */
export async function requireTenantInfrastructure() {
  if (!infrastructureReady) {
    infrastructureReady = bootstrapTenant().catch((error) => {
      infrastructureReady = null;
      throw error;
    });
  }

  await infrastructureReady;
}

async function bootstrapTenant() {
  const business = await Business.findOneAndUpdate(
    { code: BOOTSTRAP_BUSINESS_CODE },
    {
      $setOnInsert: {
        name: "Aapka Bazar",
        code: BOOTSTRAP_BUSINESS_CODE,
        legalName: "",
        gstin: "",
        isGstRegistered: false,
        reorderMultiple: 2,
        isActive: true,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );

  const store = await Store.findOneAndUpdate(
    { businessId: business._id, code: BOOTSTRAP_STORE_CODE },
    {
      $setOnInsert: {
        businessId: business._id,
        name: "Main store",
        code: BOOTSTRAP_STORE_CODE,
        isDefault: true,
        isActive: true,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );

  const ownership = {
    businessId: business._id,
    storeId: store._id,
  };
  const missingBusiness = {
    $or: [{ businessId: { $exists: false } }, { businessId: null }],
  };

  await Promise.all([
    Product.updateMany(missingBusiness, { $set: ownership }),
    Category.updateMany(
      { $or: [{ businessId: { $exists: false } }, { businessId: null }] },
      { $set: { businessId: business._id } },
    ),
    Purchase.updateMany(missingBusiness, { $set: ownership }),
    InventoryLog.collection.updateMany(missingBusiness, { $set: ownership }),
    StockAdjustment.updateMany(missingBusiness, { $set: ownership }),
    Supplier.updateMany(missingBusiness, { $set: ownership }),
    Customer.updateMany(
      { $or: [{ businessId: { $exists: false } }, { businessId: null }] },
      { $set: { businessId: business._id } },
    ),
    Order.updateMany(missingBusiness, { $set: ownership }),
  ]);

  await BusinessSettings.findOneAndUpdate(
    { businessId: business._id },
    { $setOnInsert: { businessId: business._id } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );

  await backfillPurchaseSnapshots();

  await Promise.all([
    Business.syncIndexes(),
    BusinessSettings.syncIndexes(),
    Store.syncIndexes(),
    Product.syncIndexes(),
    Category.syncIndexes(),
    Purchase.syncIndexes(),
    StockAdjustment.syncIndexes(),
    InventoryLog.syncIndexes(),
    Sale.syncIndexes(),
    Payment.syncIndexes(),
    HeldCart.syncIndexes(),
    Customer.syncIndexes(),
  ]);
}

async function backfillPurchaseSnapshots() {
  await Purchase.collection.updateMany(
    { "items.productNameSnapshot": { $exists: false } },
    [
      {
        $set: {
          supplierInvoiceNumber: { $ifNull: ["$supplierInvoiceNumber", ""] },
          items: {
            $map: {
              input: "$items",
              as: "item",
              in: {
                $mergeObjects: [
                  "$$item",
                  {
                    productName: {
                      $ifNull: [
                        "$$item.productName",
                        "$$item.productNameSnapshot",
                      ],
                    },
                    sku: { $ifNull: ["$$item.sku", "$$item.skuSnapshot"] },
                    productNameSnapshot: {
                      $ifNull: [
                        "$$item.productNameSnapshot",
                        "$$item.productName",
                      ],
                    },
                    skuSnapshot: {
                      $ifNull: ["$$item.skuSnapshot", "$$item.sku"],
                    },
                    taxAmount: {
                      $ifNull: [
                        "$$item.taxAmount",
                        {
                          $max: [
                            0,
                            {
                              $subtract: [
                                "$$item.total",
                                {
                                  $max: [
                                    0,
                                    {
                                      $subtract: [
                                        {
                                          $multiply: [
                                            "$$item.quantity",
                                            "$$item.purchasePrice",
                                          ],
                                        },
                                        { $ifNull: ["$$item.discount", 0] },
                                      ],
                                    },
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ],
  );
}
