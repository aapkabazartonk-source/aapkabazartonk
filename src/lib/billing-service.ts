import { Types, type ClientSession } from "mongoose";
import type { InvoiceType } from "@/lib/constants";
import { BillingError } from "@/lib/billing-error";
import { nextDailySequence } from "@/lib/document-numbers";
import {
  calculateSale,
  type BusinessTaxSettings,
  type CatalogSaleLine,
  type SaleCalculation,
} from "@/lib/gst";
import {
  InventoryError,
  isIdempotencyConflict,
  duplicateKeyPattern,
  mutateProductStock,
  withMongoTransaction,
  writeInventoryLog,
  type StockScope,
} from "@/lib/inventory-stock";
import { stateCodeFromGstin, stateName } from "@/lib/india-states";
import {
  settlePayments,
  type PaymentSettlement,
} from "@/lib/payment-settlement";
import { roundMoney } from "@/lib/money";
import { roleHasPermission } from "@/lib/permissions";
import { getBillingRuntimeSettings } from "@/lib/settings-service";
import type {
  CheckoutValues,
  HoldCartValues,
  QuoteValues,
} from "@/lib/validators/billing";
import type { UserRole } from "@/lib/constants";
import { Business } from "@/models/Business";
import { Customer } from "@/models/Customer";
import { HeldCart } from "@/models/HeldCart";
import { Payment } from "@/models/Payment";
import { Product } from "@/models/Product";
import { Sale } from "@/models/Sale";
import { Store } from "@/models/Store";

type ProductRow = {
  _id: Types.ObjectId;
  name: string;
  sku: string;
  barcode?: string;
  unit: string;
  hsn?: string;
  gstRate?: number;
  sellingPrice: number;
  currentStock: number;
  isActive: boolean;
};

type BusinessRow = {
  _id: Types.ObjectId;
  name: string;
  legalName?: string;
  logoUrl?: string;
  gstin?: string;
  isGstRegistered?: boolean;
  pricesIncludeGst?: boolean;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  pincode?: string;
};

type BillingScope = StockScope;

type StoreRow = {
  _id: Types.ObjectId;
  name: string;
  code: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  pincode?: string;
};

type CustomerRow = {
  _id: Types.ObjectId;
  businessId?: Types.ObjectId | null;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  stateCode?: string;
  isActive?: boolean;
};

function joinAddress(parts: Array<string | undefined | null>) {
  return parts
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function taxSettings(business: BusinessRow): BusinessTaxSettings {
  return {
    isGstRegistered: Boolean(business.isGstRegistered),
    gstin: (business.gstin ?? "").trim().toUpperCase(),
    stateCode: (business.stateCode ?? "").trim(),
    pricesIncludeGst: Boolean(business.pricesIncludeGst),
  };
}

function customerStateCode(customer: CustomerRow | null) {
  if (!customer) return "";
  const explicit = (customer.stateCode ?? "").trim();
  if (explicit) return explicit;
  return stateCodeFromGstin(customer.gstin ?? "");
}

async function loadBusiness(businessId: Types.ObjectId, session?: ClientSession) {
  const query = Business.findById(businessId);
  if (session) query.session(session);
  const business = await query.lean<BusinessRow | null>();
  if (!business) {
    throw new BillingError("Business not found.", 403, "BUSINESS_NOT_FOUND");
  }
  return business;
}

async function loadStore(
  businessId: Types.ObjectId,
  storeId: Types.ObjectId,
  session?: ClientSession,
) {
  const query = Store.findOne({ _id: storeId, businessId, isActive: true });
  if (session) query.session(session);
  const store = await query.lean<StoreRow | null>();
  if (!store) {
    throw new BillingError("Store not found.", 403, "STORE_NOT_FOUND");
  }
  return store;
}

async function loadCustomer(
  businessId: Types.ObjectId,
  customerId: string | null | undefined,
  session?: ClientSession,
) {
  if (!customerId) return null;
  const query = Customer.findOne({ _id: customerId, businessId });
  if (session) query.session(session);
  const customer = await query.lean<CustomerRow | null>();
  if (!customer || customer.isActive === false) {
    throw new BillingError("Customer not found.", 404, "CUSTOMER_NOT_FOUND");
  }
  return customer;
}

async function loadProducts(
  businessId: Types.ObjectId,
  productIds: string[],
  session?: ClientSession,
) {
  const query = Product.find({
    _id: { $in: productIds },
    businessId,
  }).select(
    "name sku barcode unit hsn gstRate sellingPrice currentStock isActive",
  );
  if (session) query.session(session);
  const products = await query.lean<ProductRow[]>();
  return new Map(products.map((product) => [product._id.toString(), product]));
}

async function buildCalculation(params: {
  scope: StockScope;
  items: QuoteValues["items"];
  billDiscount: number;
  customerId?: string | null;
  session?: ClientSession;
  enforceStock: boolean;
}) {
  const business = await loadBusiness(params.scope.businessId, params.session);
  const customer = await loadCustomer(
    params.scope.businessId,
    params.customerId,
    params.session,
  );
  const products = await loadProducts(
    params.scope.businessId,
    params.items.map((item) => item.productId),
    params.session,
  );

  const catalog: CatalogSaleLine[] = params.items.map((item) => {
    const product = products.get(item.productId);
    if (!product) {
      throw new BillingError("One or more products were not found.", 404, "PRODUCT_NOT_FOUND");
    }
    if (!product.isActive) {
      throw new BillingError(
        `"${product.name}" is inactive and cannot be billed.`,
        409,
        "PRODUCT_INACTIVE",
      );
    }
    if (params.enforceStock && item.quantity > product.currentStock) {
      throw new BillingError(
        `Insufficient stock for "${product.name}". Available: ${product.currentStock}, requested: ${item.quantity}.`,
        409,
        "INSUFFICIENT_STOCK",
      );
    }
    return {
      productId: product._id.toString(),
      productName: product.name,
      sku: product.sku,
      barcode: product.barcode ?? "",
      unit: product.unit,
      hsn: (product.hsn ?? "").trim(),
      quantity: item.quantity,
      unitPrice: product.sellingPrice,
      gstRate: product.gstRate ?? 0,
      itemDiscount: item.discount ?? 0,
    };
  });

  const calculation = calculateSale({
    settings: taxSettings(business),
    customerStateCode: customerStateCode(customer),
    lines: catalog,
    billDiscount: params.billDiscount,
  });

  return { business, customer, products, calculation };
}

function snapshotAddress(store: StoreRow, business: BusinessRow) {
  const storeAddress = joinAddress([
    store.address,
    store.city,
    store.state,
    store.pincode,
  ]);
  if (storeAddress) return storeAddress;
  return joinAddress([
    business.address,
    business.city,
    business.state,
    business.pincode,
  ]);
}

function buildSnapshot(params: {
  business: BusinessRow;
  store: StoreRow;
  customer: CustomerRow | null;
  calculation: SaleCalculation;
  invoiceSettings: Awaited<
    ReturnType<typeof getBillingRuntimeSettings>
  >["invoice"];
}) {
  const { business, store, customer, calculation, invoiceSettings } = params;
  const businessState = (business.stateCode ?? "").trim();
  const customerCode = customerStateCode(customer);
  const showAddress = invoiceSettings.showAddress !== false;
  return {
    businessName: business.name,
    legalName: business.legalName ?? "",
    gstin: calculation.invoiceType === "TAX_INVOICE" || business.isGstRegistered
      ? (business.gstin ?? "").trim().toUpperCase()
      : "",
    isGstRegistered: Boolean(business.isGstRegistered),
    stateCode: businessState,
    stateName: business.state || stateName(businessState),
    address: showAddress ? snapshotAddress(store, business) : "",
    phone: (store.phone || business.phone || "").trim(),
    storeName: store.name,
    storeCode: store.code,
    pricesIncludeGst: Boolean(business.pricesIncludeGst),
    customerName: customer?.name?.trim() || "Walk-in customer",
    customerPhone: customer?.phone ?? "",
    customerGstin: (customer?.gstin ?? "").trim().toUpperCase(),
    customerAddress: customer?.address ?? "",
    customerStateCode: customerCode,
    customerStateName: stateName(customerCode),
    supplyType: calculation.supplyType,
    placeOfSupply: stateName(customerCode || businessState) || business.state || "",
    logoUrl: invoiceSettings.showLogo ? (business.logoUrl ?? "").trim() : "",
    footerNote: invoiceSettings.footerNote ?? "",
    termsAndConditions: invoiceSettings.termsAndConditions ?? "",
    thankYouMessage: invoiceSettings.thankYouMessage ?? "",
    paperSize: invoiceSettings.paperSize ?? "80mm",
    showGstin: invoiceSettings.showGstin !== false,
    showLogo: invoiceSettings.showLogo !== false,
    showAddress,
  };
}

function sanitizeDocumentPrefix(value: string, fallback: string) {
  const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned || !/^[A-Z]/.test(cleaned)) return fallback;
  return cleaned.slice(0, 12);
}

async function nextSaleNumbers(
  businessId: Types.ObjectId,
  invoiceType: InvoiceType,
  session: ClientSession,
  prefixes: { salePrefix: string; taxInvoicePrefix: string; billOfSupplyPrefix: string },
) {
  const salePrefix = sanitizeDocumentPrefix(prefixes.salePrefix, "SAL");
  const invoicePrefix = sanitizeDocumentPrefix(
    invoiceType === "TAX_INVOICE"
      ? prefixes.taxInvoicePrefix
      : prefixes.billOfSupplyPrefix,
    invoiceType === "TAX_INVOICE" ? "INV" : "BOS",
  );

  const saleNumber = await nextDailySequence(async (prefix) => {
    return Sale.countDocuments({
      businessId,
      saleNumber: { $regex: `^${prefix}` },
    }).session(session);
  }, salePrefix);

  const invoiceNumber = await nextDailySequence(async (prefix) => {
    return Sale.countDocuments({
      businessId,
      invoiceNumber: { $regex: `^${prefix}` },
    }).session(session);
  }, invoicePrefix);

  return { saleNumber, invoiceNumber };
}

async function assertBillingPreferences(params: {
  businessId: Types.ObjectId;
  billDiscount: number;
  allowCredit: boolean;
  role?: UserRole | null;
  subtotalHint?: number;
}) {
  const runtime = await getBillingRuntimeSettings(params.businessId);
  const billing = runtime.billing;

  if (params.allowCredit && !billing.allowCreditSales) {
    throw new BillingError(
      "Credit sales are disabled in billing settings.",
      409,
      "CREDIT_DISABLED",
    );
  }

  const discount = roundMoney(params.billDiscount ?? 0);
  if (discount > 0 && !billing.enableBillDiscount) {
    throw new BillingError(
      "Bill discounts are disabled in billing settings.",
      409,
      "DISCOUNT_DISABLED",
    );
  }

  if (discount > 0) {
    const canOverride = roleHasPermission(
      params.role ?? "owner",
      "pos.discount_override",
    );
    if (billing.maxBillDiscountAmount > 0 && discount > billing.maxBillDiscountAmount) {
      if (!canOverride) {
        throw new BillingError(
          `Bill discount cannot exceed ${billing.maxBillDiscountAmount}.`,
          403,
          "DISCOUNT_LIMIT",
        );
      }
    }
    if (
      billing.maxBillDiscountPercent < 100 &&
      params.subtotalHint &&
      params.subtotalHint > 0
    ) {
      const maxByPercent = roundMoney(
        (params.subtotalHint * billing.maxBillDiscountPercent) / 100,
      );
      if (discount > maxByPercent && !canOverride) {
        throw new BillingError(
          `Bill discount cannot exceed ${billing.maxBillDiscountPercent}% without override permission.`,
          403,
          "DISCOUNT_LIMIT",
        );
      }
    }
  }

  return runtime;
}

async function findIdempotentSale(businessId: Types.ObjectId, key: string) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const existing = await Sale.findOne({ businessId, idempotencyKey: key });
    if (existing) return existing;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  return null;
}

async function paymentsFor(businessId: Types.ObjectId, saleId: Types.ObjectId) {
  return Payment.find({ businessId, sale: saleId }).sort({ sequence: 1 }).lean();
}

function publicBusiness(business: BusinessRow) {
  return {
    name: business.name,
    legalName: business.legalName ?? "",
    gstin: business.gstin ?? "",
    isGstRegistered: Boolean(business.isGstRegistered),
    pricesIncludeGst: Boolean(business.pricesIncludeGst),
    stateCode: business.stateCode ?? "",
    stateName: business.state || stateName(business.stateCode),
    phone: business.phone ?? "",
    address: joinAddress([
      business.address,
      business.city,
      business.state,
      business.pincode,
    ]),
  };
}

function publicCustomer(customer: CustomerRow | null) {
  if (!customer) return null;
  return {
    _id: customer._id,
    name: customer.name,
    phone: customer.phone ?? "",
    gstin: customer.gstin ?? "",
    stateCode: customerStateCode(customer),
    stateName: stateName(customerStateCode(customer)),
  };
}

export async function quoteSale(params: {
  data: QuoteValues;
  scope: BillingScope;
}) {
  const { data, scope } = params;
  await assertBillingPreferences({
    businessId: scope.businessId,
    billDiscount: data.billDiscount,
    allowCredit: Boolean(data.allowCredit),
    role: scope.role,
  });

  const built = await buildCalculation({
    scope,
    items: data.items,
    billDiscount: data.billDiscount,
    customerId: data.customerId,
    enforceStock: true,
  });

  await assertBillingPreferences({
    businessId: scope.businessId,
    billDiscount: data.billDiscount,
    allowCredit: Boolean(data.allowCredit),
    role: scope.role,
    subtotalHint: built.calculation.totals.subtotal,
  });

  let settlement: PaymentSettlement | null = null;
  if (data.settle) {
    settlement = settlePayments(
      built.calculation.totals.grandTotal,
      data.payments,
      data.allowCredit,
    );
  }

  return {
    ...built.calculation,
    settlement,
    business: publicBusiness(built.business),
    customer: publicCustomer(built.customer),
  };
}

export async function checkoutSale(params: {
  data: CheckoutValues;
  scope: BillingScope;
}) {
  const { data, scope } = params;
  const key = data.idempotencyKey.trim();

  await assertBillingPreferences({
    businessId: scope.businessId,
    billDiscount: data.billDiscount,
    allowCredit: Boolean(data.allowCredit),
    role: scope.role,
  });

  const already = await Sale.findOne({
    businessId: scope.businessId,
    idempotencyKey: key,
  });
  if (already) {
    return {
      sale: already.toObject(),
      payments: await paymentsFor(scope.businessId, already._id),
      replayed: true,
    };
  }

  const runtime = await getBillingRuntimeSettings(scope.businessId);

  try {
    const result = await withMongoTransaction(async (session) => {
      const replay = await Sale.findOne({
        businessId: scope.businessId,
        idempotencyKey: key,
      }).session(session);
      if (replay) {
        return { sale: replay.toObject(), replayed: true as const };
      }

      const built = await buildCalculation({
        scope,
        items: data.items,
        billDiscount: data.billDiscount,
        customerId: data.customerId,
        session,
        enforceStock: true,
      });
      const store = await loadStore(scope.businessId, scope.storeId, session);
      const settlement = settlePayments(
        built.calculation.totals.grandTotal,
        data.payments,
        data.allowCredit,
      );

      const ordered = [...built.calculation.lines].sort((a, b) =>
        a.productId.localeCompare(b.productId),
      );
      const stockMoves: {
        productId: Types.ObjectId;
        quantity: number;
        previousStock: number;
        newStock: number;
      }[] = [];

      for (const line of ordered) {
        try {
          const mutated = await mutateProductStock({
            scope,
            productId: line.productId,
            quantity: line.quantity,
            movementType: "SALE",
            session,
          });
          stockMoves.push({
            productId: mutated.product._id,
            quantity: mutated.loggedQuantity,
            previousStock: mutated.previousStock,
            newStock: mutated.newStock,
          });
        } catch (error) {
          if (error instanceof InventoryError && error.code === "STOCK_CONFLICT") {
            throw error;
          }
          if (error instanceof InventoryError && error.code === "INSUFFICIENT_STOCK") {
            throw new BillingError(
              `Insufficient stock for "${line.productName}". ${error.message}`,
              409,
              "INSUFFICIENT_STOCK",
            );
          }
          throw error;
        }
      }

      await assertBillingPreferences({
        businessId: scope.businessId,
        billDiscount: data.billDiscount,
        allowCredit: Boolean(data.allowCredit),
        role: scope.role,
        subtotalHint: built.calculation.totals.subtotal,
      });

      const numbers = await nextSaleNumbers(
        scope.businessId,
        built.calculation.invoiceType,
        session,
        {
          salePrefix: runtime.invoice.salePrefix,
          taxInvoicePrefix: runtime.invoice.taxInvoicePrefix,
          billOfSupplyPrefix: runtime.invoice.billOfSupplyPrefix,
        },
      );
      const snapshot = buildSnapshot({
        business: built.business,
        store,
        customer: built.customer,
        calculation: built.calculation,
        invoiceSettings: runtime.invoice,
      });

      const [sale] = await Sale.create(
        [
          {
            businessId: scope.businessId,
            storeId: scope.storeId,
            saleNumber: numbers.saleNumber,
            invoiceNumber: numbers.invoiceNumber,
            idempotencyKey: key,
            customer: built.customer?._id ?? null,
            items: built.calculation.lines.map((line) => ({
              product: new Types.ObjectId(line.productId),
              productName: line.productName,
              sku: line.sku,
              barcode: line.barcode,
              quantity: line.quantity,
              unit: line.unit,
              unitPrice: line.unitPrice,
              discount: line.discount,
              billDiscountShare: line.billDiscountShare,
              hsn: line.hsn,
              taxRate: line.taxRate,
              taxableAmount: line.taxableAmount,
              cgst: line.cgst,
              sgst: line.sgst,
              igst: line.igst,
              taxAmount: line.taxAmount,
              finalAmount: line.finalAmount,
            })),
            ...built.calculation.totals,
            amountPaid: settlement.amountPaid,
            balanceDue: settlement.balanceDue,
            changeGiven: settlement.changeGiven,
            paymentStatus: settlement.paymentStatus,
            saleStatus: "COMPLETED",
            invoiceType: built.calculation.invoiceType,
            supplyType: built.calculation.supplyType,
            pricesIncludeGst: built.calculation.pricesIncludeGst,
            notes: data.notes ?? "",
            invoiceSnapshot: snapshot,
            createdBy: scope.performedBy ?? null,
          },
        ],
        { session },
      );

      for (const move of stockMoves) {
        await writeInventoryLog({
          scope,
          productId: move.productId,
          movementType: "SALE",
          quantity: move.quantity,
          previousStock: move.previousStock,
          newStock: move.newStock,
          reason: `POS sale ${sale.saleNumber}`,
          notes: sale.invoiceNumber,
          referenceType: "SALE",
          referenceId: sale._id,
          referenceNumber: sale.saleNumber,
          session,
        });
      }

      if (settlement.payments.length > 0) {
        await Payment.create(
          settlement.payments.map((payment, index) => ({
            businessId: scope.businessId,
            storeId: scope.storeId,
            sale: sale._id,
            sequence: index + 1,
            paymentMethod: payment.method,
            amount: payment.amount,
            tenderedAmount: payment.tenderedAmount,
            changeGiven: payment.changeGiven,
            referenceNumber: payment.referenceNumber,
            status: payment.status,
            verification: payment.verification,
            receivedBy: scope.performedBy ?? null,
          })),
          { session, ordered: true },
        );
      }

      if (built.customer) {
        await Customer.updateOne(
          { _id: built.customer._id, businessId: scope.businessId },
          {
            $inc: {
              totalSpent: built.calculation.totals.grandTotal,
              orderCount: 1,
            },
          },
          { session },
        );
      }

      if (data.heldCartId) {
        const held = await HeldCart.findOne({
          _id: data.heldCartId,
          businessId: scope.businessId,
          storeId: scope.storeId,
        }).session(session);
        if (!held) {
          throw new BillingError("Held bill not found.", 404, "HELD_CART_NOT_FOUND");
        }
        if (held.status !== "HELD") {
          throw new BillingError(
            "This held bill was already checked out or discarded.",
            409,
            "HELD_CART_CONFLICT",
          );
        }
        held.status = "RESUMED";
        held.sale = sale._id;
        held.resumedAt = new Date();
        await held.save({ session });
      }

      return { sale: sale.toObject(), replayed: false as const };
    });

    return {
      sale: result.sale,
      payments: await paymentsFor(scope.businessId, result.sale._id),
      replayed: result.replayed,
    };
  } catch (error) {
    if (isIdempotencyConflict(error)) {
      const existing = await findIdempotentSale(scope.businessId, key);
      if (existing) {
        return {
          sale: existing.toObject(),
          payments: await paymentsFor(scope.businessId, existing._id),
          replayed: true,
        };
      }
    }
    throw error;
  }
}

async function heldItemsFromRequest(
  scope: StockScope,
  items: HoldCartValues["items"],
) {
  const products = await loadProducts(
    scope.businessId,
    items.map((item) => item.productId),
  );
  return items.map((item) => {
    const product = products.get(item.productId);
    if (!product) {
      throw new BillingError("One or more products were not found.", 404);
    }
    if (!product.isActive) {
      throw new BillingError(`"${product.name}" is inactive and cannot be held.`, 409);
    }
    return {
      product: product._id,
      productName: product.name,
      sku: product.sku,
      barcode: product.barcode ?? "",
      quantity: item.quantity,
      discount: item.discount ?? 0,
    };
  });
}

export async function holdCart(params: { data: HoldCartValues; scope: StockScope }) {
  const { data, scope } = params;
  if (data.customerId) {
    await loadCustomer(scope.businessId, data.customerId);
  }
  const cartItems = await heldItemsFromRequest(scope, data.items);
  const payload = {
    cartItems,
    customer: data.customerId ? new Types.ObjectId(data.customerId) : null,
    billDiscount: data.billDiscount,
    notes: data.notes ?? "",
  };

  if (data.heldCartId) {
    const existing = await HeldCart.findOne({
      _id: data.heldCartId,
      businessId: scope.businessId,
      storeId: scope.storeId,
    });
    if (!existing) {
      throw new BillingError("Held bill not found.", 404, "HELD_CART_NOT_FOUND");
    }
    if (existing.status !== "HELD") {
      throw new BillingError(
        "This held bill was already checked out or discarded.",
        409,
        "HELD_CART_CONFLICT",
      );
    }
    existing.cartItems = cartItems;
    existing.customer = payload.customer;
    existing.billDiscount = payload.billDiscount;
    existing.notes = payload.notes;
    await existing.save();
    return existing.toObject();
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const holdNumber = await nextDailySequence(async (prefix) => {
        return HeldCart.countDocuments({
          businessId: scope.businessId,
          holdNumber: { $regex: `^${prefix}` },
        });
      }, "HLD");
      const created = await HeldCart.create({
        businessId: scope.businessId,
        storeId: scope.storeId,
        holdNumber,
        ...payload,
        status: "HELD",
        createdBy: scope.performedBy ?? null,
      });
      return created.toObject();
    } catch (error) {
      const pattern = duplicateKeyPattern(error);
      if (pattern && "holdNumber" in pattern && attempt < 2) continue;
      throw error;
    }
  }

  throw new BillingError("Could not allocate a hold number.", 500);
}

export async function listHeldCarts(scope: StockScope) {
  const carts = await HeldCart.find({
    businessId: scope.businessId,
    storeId: scope.storeId,
    status: "HELD",
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const customerIds = carts
    .map((cart) => cart.customer)
    .filter((id): id is Types.ObjectId => Boolean(id));
  const customers = customerIds.length
    ? await Customer.find({
        _id: { $in: customerIds },
        businessId: scope.businessId,
      })
        .select("name phone")
        .lean<CustomerRow[]>()
    : [];
  const byId = new Map(customers.map((customer) => [customer._id.toString(), customer]));

  return carts.map((cart) => ({
    ...cart,
    customerName: cart.customer
      ? byId.get(cart.customer.toString())?.name ?? "Customer"
      : "Walk-in customer",
    itemCount: cart.cartItems.reduce((sum, item) => sum + item.quantity, 0),
  }));
}

export async function resumeHeldCart(scope: StockScope, heldCartId: string) {
  const held = await HeldCart.findOne({
    _id: heldCartId,
    businessId: scope.businessId,
    storeId: scope.storeId,
    status: "HELD",
  }).lean();
  if (!held) {
    throw new BillingError("Held bill not found.", 404, "HELD_CART_NOT_FOUND");
  }

  const products = await loadProducts(
    scope.businessId,
    held.cartItems.map((item) => item.product.toString()),
  );

  return {
    heldCartId: held._id,
    holdNumber: held.holdNumber,
    customerId: held.customer ? held.customer.toString() : null,
    billDiscount: held.billDiscount,
    notes: held.notes,
    items: held.cartItems.map((item) => {
      const product = products.get(item.product.toString());
      return {
        productId: item.product.toString(),
        quantity: item.quantity,
        discount: item.discount,
        productName: item.productName,
        sku: item.sku,
        barcode: item.barcode,
        available: Boolean(product?.isActive),
        product: product
          ? {
              name: product.name,
              sku: product.sku,
              barcode: product.barcode ?? "",
              unit: product.unit,
              hsn: product.hsn ?? "",
              gstRate: product.gstRate ?? 0,
              sellingPrice: product.sellingPrice,
              currentStock: product.currentStock,
              isActive: product.isActive,
            }
          : null,
      };
    }),
  };
}

export async function discardHeldCart(scope: StockScope, heldCartId: string) {
  const held = await HeldCart.findOneAndUpdate(
    {
      _id: heldCartId,
      businessId: scope.businessId,
      storeId: scope.storeId,
      status: "HELD",
    },
    { $set: { status: "DISCARDED" } },
    { returnDocument: "after" },
  );
  if (!held) {
    throw new BillingError("Held bill not found.", 404, "HELD_CART_NOT_FOUND");
  }
  return held.toObject();
}

export async function listSales(params: {
  businessId: Types.ObjectId;
  filter: Record<string, unknown>;
  page: number;
  limit: number;
  skip: number;
}) {
  const { businessId, filter, page, limit, skip } = params;
  const scoped = { ...filter, businessId };
  const [total, sales, summary, paid, partial, unpaid] = await Promise.all([
    Sale.countDocuments(scoped),
    Sale.find(scoped)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "saleNumber invoiceNumber invoiceSnapshot.customerName invoiceSnapshot.customerPhone grandTotal amountPaid balanceDue paymentStatus saleStatus invoiceType createdAt",
      )
      .lean(),
    Sale.aggregate<{ totalBilled: number; collected: number; due: number }>([
      { $match: scoped },
      {
        $group: {
          _id: null,
          totalBilled: { $sum: "$grandTotal" },
          collected: { $sum: "$amountPaid" },
          due: { $sum: "$balanceDue" },
        },
      },
    ]),
    Sale.countDocuments({ businessId, paymentStatus: "PAID" }),
    Sale.countDocuments({ businessId, paymentStatus: "PARTIAL" }),
    Sale.countDocuments({ businessId, paymentStatus: "UNPAID" }),
  ]);

  return {
    data: sales,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    stats: {
      paid,
      partial,
      unpaid,
      totalBilled: summary[0]?.totalBilled ?? 0,
      collected: summary[0]?.collected ?? 0,
      due: summary[0]?.due ?? 0,
    },
  };
}

export async function getSaleBundle(businessId: Types.ObjectId, saleId: string) {
  const sale = await Sale.findOne({ _id: saleId, businessId }).lean();
  if (!sale) return null;
  const payments = await paymentsFor(businessId, sale._id);
  return { sale, payments };
}
