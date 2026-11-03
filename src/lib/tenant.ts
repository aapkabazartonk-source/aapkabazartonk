import { Types } from "mongoose";
import { getAuthContext, type AuthContext } from "@/lib/auth";
import { isValidObjectId } from "@/lib/api";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/models/Business";
import { Category } from "@/models/Category";
import { Customer } from "@/models/Customer";
import { InventoryLog } from "@/models/InventoryLog";
import { Order } from "@/models/Order";
import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";
import { StockAdjustment } from "@/models/StockAdjustment";
import { Store } from "@/models/Store";
import { Supplier } from "@/models/Supplier";
import { User } from "@/models/User";

/**
 * Business context for every inventory and catalog query.
 *
 * Authentication is not implemented yet. The login screen does not create a
 * session, and getAuthContext() returns { userId: null }. This module does
 * not invent a signed-in user.
 *
 * Until sign-in exists, the server owns one bootstrap business (code DEFAULT)
 * and its default store. The client cannot choose a businessId. If more than
 * one business exists and the request has no user, access is rejected so data
 * cannot leak across tenants.
 *
 * Integration requirements when authentication is added:
 * 1. getAuthContext(request) must return the signed-in user's id from the
 *    session cookie or token. Do not read businessId from the body or query.
 * 2. On registration, create a Business and a default Store, then set
 *    User.businessId and User.defaultStoreId.
 * 3. resolveTenantContext loads that membership and rejects users with no
 *    business (403) or an inactive user (401).
 * 4. Every query stays filtered by the resolved businessId. storeId is stamped
 *    on purchases, adjustments, and inventory logs.
 * 5. Remove reliance on the DEFAULT bootstrap for real customer traffic. Keep
 *    it only if you still need a local single-store workspace.
 */
export class TenantError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "TenantError";
    this.status = status;
  }
}

export type TenantContext = {
  businessId: Types.ObjectId;
  storeId: Types.ObjectId;
  userId: string | null;
  reorderMultiple: number;
  /** False while getAuthContext cannot identify a user. */
  authIntegrated: boolean;
};

const BOOTSTRAP_BUSINESS_CODE = "DEFAULT";
const BOOTSTRAP_STORE_CODE = "MAIN";

let infrastructureReady: Promise<void> | null = null;

export async function requireTenant(request?: Request): Promise<TenantContext> {
  const auth = await getAuthContext(request);
  return resolveTenantContext(auth);
}

export async function resolveTenantContext(
  auth: AuthContext,
): Promise<TenantContext> {
  await connectToDatabase();
  await ensureTenantInfrastructure();

  if (auth.userId) {
    if (!isValidObjectId(auth.userId)) {
      throw new TenantError("Authenticated user is invalid.", 401);
    }

    const user = await User.findById(auth.userId)
      .select("businessId defaultStoreId isActive")
      .lean<{
        businessId?: Types.ObjectId | null;
        defaultStoreId?: Types.ObjectId | null;
        isActive?: boolean;
      } | null>();

    if (!user || user.isActive === false) {
      throw new TenantError("Sign in is required.", 401);
    }

    if (!user.businessId) {
      throw new TenantError(
        "This user is not assigned to a business. Set User.businessId and User.defaultStoreId when authentication is integrated.",
        403,
      );
    }

    const business = await Business.findOne({
      _id: user.businessId,
      isActive: true,
    }).lean();

    if (!business) {
      throw new TenantError("Business not found for this user.", 403);
    }

    const store = user.defaultStoreId
      ? await Store.findOne({
          _id: user.defaultStoreId,
          businessId: business._id,
          isActive: true,
        }).lean()
      : await Store.findOne({
          businessId: business._id,
          isDefault: true,
          isActive: true,
        }).lean();

    if (!store) {
      throw new TenantError("This business has no active store.", 403);
    }

    return {
      businessId: business._id,
      storeId: store._id,
      userId: auth.userId,
      reorderMultiple: business.reorderMultiple ?? 2,
      authIntegrated: true,
    };
  }

  const businesses = await Business.find({ isActive: true })
    .select("reorderMultiple code")
    .limit(2)
    .lean();

  if (businesses.length !== 1) {
    throw new TenantError(
      "More than one business exists, but sign-in is not integrated. Authentication must resolve the user's business before data can be accessed.",
      403,
    );
  }

  const business = businesses[0];
  const store = await Store.findOne({
    businessId: business._id,
    isDefault: true,
  }).lean();

  if (!store) {
    throw new TenantError("Default store is missing.", 500);
  }

  return {
    businessId: business._id,
    storeId: store._id,
    userId: null,
    reorderMultiple: business.reorderMultiple ?? 2,
    authIntegrated: false,
  };
}

async function ensureTenantInfrastructure() {
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

  await backfillPurchaseSnapshots();

  await Promise.all([
    Business.syncIndexes(),
    Store.syncIndexes(),
    Product.syncIndexes(),
    Category.syncIndexes(),
    Purchase.syncIndexes(),
    StockAdjustment.syncIndexes(),
    InventoryLog.syncIndexes(),
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
                    $ifNull: ["$$item.productName", "$$item.productNameSnapshot"],
                  },
                  sku: { $ifNull: ["$$item.sku", "$$item.skuSnapshot"] },
                  productNameSnapshot: {
                    $ifNull: ["$$item.productNameSnapshot", "$$item.productName"],
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
  ]);
}
