import { Types, type ClientSession } from "mongoose";
import { nextDailySequence } from "@/lib/document-numbers";
import {
  duplicateKeyPattern,
  InventoryError,
  mutateProductStock,
  withMongoTransaction,
  writeInventoryLog,
  type StockScope,
} from "@/lib/inventory-stock";
import { multiplyMoney, roundMoney, sumMoney } from "@/lib/money";
import type {
  PurchaseCreateValues,
  PurchaseUpdateValues,
} from "@/lib/validators/purchase";
import { Product } from "@/models/Product";
import { Purchase, type IPurchaseItem } from "@/models/Purchase";
import { Supplier } from "@/models/Supplier";

function lineAmounts(item: {
  quantity: number;
  purchasePrice: number;
  discount?: number;
  taxRate?: number;
}) {
  const lineGross = multiplyMoney(item.quantity, item.purchasePrice);
  const lineDiscount = Math.min(lineGross, roundMoney(item.discount ?? 0));
  const taxable = Math.max(0, roundMoney(lineGross - lineDiscount));
  const taxAmount = roundMoney(taxable * ((item.taxRate ?? 0) / 100));
  const total = roundMoney(taxable + taxAmount);
  return { lineGross, lineDiscount, taxAmount, total };
}

async function buildPurchaseItems(
  items: PurchaseCreateValues["items"],
  businessId: Types.ObjectId,
  session?: ClientSession,
) {
  const built: IPurchaseItem[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.productId)) {
      throw new InventoryError(
        "Each product can appear only once on a purchase. Combine the quantity on a single line.",
      );
    }
    seen.add(item.productId);

    const query = Product.findOne({
      _id: item.productId,
      businessId,
    }).select("name sku isActive purchasePrice");
    if (session) query.session(session);
    const product = await query;
    if (!product) {
      throw new InventoryError("One or more products were not found.", 404);
    }
    if (!product.isActive) {
      throw new InventoryError(
        `Product "${product.name}" is inactive and cannot be purchased.`,
        409,
      );
    }

    const amounts = lineAmounts(item);
    built.push({
      product: product._id,
      productName: product.name,
      sku: product.sku,
      productNameSnapshot: product.name,
      skuSnapshot: product.sku,
      quantity: item.quantity,
      purchasePrice: item.purchasePrice,
      taxRate: item.taxRate ?? 0,
      discount: amounts.lineDiscount,
      taxAmount: amounts.taxAmount,
      total: amounts.total,
    });
  }

  return built;
}

/**
 * subtotal = sum of quantity × purchase price
 * discount = invoice-level discount (line discounts stay on each item)
 * tax = sum of line GST amounts (non-GST purchases keep every rate at 0)
 * total = subtotal − line discounts − invoice discount + tax
 */
function summarizeItems(items: IPurchaseItem[], invoiceDiscount = 0) {
  const subtotal = sumMoney(
    items.map((item) => multiplyMoney(item.quantity, item.purchasePrice)),
  );
  const lineDiscount = sumMoney(items.map((item) => item.discount));
  const discount = roundMoney(invoiceDiscount);
  const tax = sumMoney(items.map((item) => item.taxAmount));
  const total = Math.max(
    0,
    roundMoney(subtotal - lineDiscount - discount + tax),
  );
  return { subtotal, discount, tax, total };
}

async function assertSupplier(
  supplierId: string | null | undefined,
  businessId: Types.ObjectId,
) {
  if (!supplierId) return null;
  const supplier = await Supplier.findOne({
    _id: supplierId,
    businessId,
    isActive: { $ne: false },
  }).select("_id");
  if (!supplier) {
    throw new InventoryError("Supplier not found.", 404);
  }
  return supplier._id;
}

async function nextPurchaseNumber(
  businessId: Types.ObjectId,
  session?: ClientSession,
) {
  return nextDailySequence(async (prefix) => {
    const query = Purchase.countDocuments({
      businessId,
      purchaseNumber: { $regex: `^${prefix}` },
    });
    if (session) query.session(session);
    return query;
  }, "PUR");
}

export async function createPurchaseDraft(params: {
  data: PurchaseCreateValues;
  scope: StockScope;
}) {
  const { data, scope } = params;
  const items = await buildPurchaseItems(data.items, scope.businessId);
  const totals = summarizeItems(items, data.discount ?? 0);
  const supplier = await assertSupplier(data.supplierId, scope.businessId);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const purchaseNumber = await nextPurchaseNumber(scope.businessId);
      const purchase = await Purchase.create({
        businessId: scope.businessId,
        storeId: scope.storeId,
        purchaseNumber,
        supplierName: data.supplierName.trim(),
        supplierContact: (data.supplierContact ?? "").trim(),
        supplierInvoiceNumber: (data.supplierInvoiceNumber ?? "").trim(),
        supplier,
        purchaseDate: data.purchaseDate ?? new Date(),
        expectedDeliveryDate: data.expectedDeliveryDate ?? null,
        items,
        ...totals,
        status: "DRAFT",
        notes: (data.notes ?? "").trim(),
        createdBy: scope.performedBy ?? null,
      });
      return purchase;
    } catch (error) {
      const pattern = duplicateKeyPattern(error);
      if (pattern && "purchaseNumber" in pattern && attempt < 2) {
        continue;
      }
      throw error;
    }
  }

  throw new InventoryError("Could not allocate a purchase number.", 500);
}

export async function updatePurchaseDraft(
  purchaseId: string,
  data: PurchaseUpdateValues,
  scope: StockScope,
) {
  const purchase = await Purchase.findOne({
    _id: purchaseId,
    businessId: scope.businessId,
  });
  if (!purchase) {
    throw new InventoryError("Purchase not found.", 404);
  }
  if (purchase.status !== "DRAFT") {
    throw new InventoryError(
      "Only draft purchases can be edited. Received purchases cannot be changed directly.",
      409,
    );
  }

  if (data.supplierName !== undefined) {
    purchase.supplierName = data.supplierName.trim();
  }
  if (data.supplierContact !== undefined) {
    purchase.supplierContact = data.supplierContact.trim();
  }
  if (data.supplierInvoiceNumber !== undefined) {
    purchase.supplierInvoiceNumber = data.supplierInvoiceNumber.trim();
  }
  if (data.supplierId !== undefined) {
    purchase.supplier = await assertSupplier(data.supplierId, scope.businessId);
  }
  if (data.purchaseDate !== undefined) {
    purchase.purchaseDate = data.purchaseDate;
  }
  if (data.expectedDeliveryDate !== undefined) {
    purchase.expectedDeliveryDate = data.expectedDeliveryDate;
  }
  if (data.notes !== undefined) {
    purchase.notes = data.notes.trim();
  }
  if (data.items) {
    purchase.items = await buildPurchaseItems(data.items, scope.businessId);
  }

  const totals = summarizeItems(
    purchase.items,
    data.discount ?? purchase.discount,
  );
  purchase.subtotal = totals.subtotal;
  purchase.discount = totals.discount;
  purchase.tax = totals.tax;
  purchase.total = totals.total;

  await purchase.save();
  return purchase;
}

export async function receivePurchase(params: {
  purchaseId: string;
  scope: StockScope;
}) {
  const { purchaseId, scope } = params;

  return withMongoTransaction(async (session) => {
    const receivedAt = new Date();
    const claimed = await Purchase.findOneAndUpdate(
      {
        _id: purchaseId,
        businessId: scope.businessId,
        status: "DRAFT",
      },
      { $set: { status: "RECEIVED", receivedAt } },
      { session, returnDocument: "after" },
    );

    if (!claimed) {
      const current = await Purchase.findOne({
        _id: purchaseId,
        businessId: scope.businessId,
      }).session(session);

      if (!current) {
        throw new InventoryError("Purchase not found.", 404);
      }
      if (current.status === "RECEIVED") {
        throw new InventoryError(
          "This purchase has already been received.",
          409,
          "ALREADY_RECEIVED",
        );
      }
      if (current.status === "CANCELLED") {
        throw new InventoryError(
          "Cancelled purchases cannot increase stock.",
          409,
          "PURCHASE_CANCELLED",
        );
      }
      throw new InventoryError("Only draft purchases can be received.", 409);
    }

    for (const item of claimed.items) {
      const product = await Product.findOne({
        _id: item.product,
        businessId: scope.businessId,
      }).session(session);

      if (!product) {
        throw new InventoryError(
          `Product on this purchase was not found (${item.skuSnapshot || item.sku}).`,
          404,
        );
      }

      const mutated = await mutateProductStock({
        scope,
        productId: item.product,
        quantity: item.quantity,
        movementType: "PURCHASE_RECEIVE",
        session,
      });

      await writeInventoryLog({
        scope,
        productId: mutated.product._id,
        movementType: "PURCHASE_RECEIVE",
        quantity: mutated.loggedQuantity,
        previousStock: mutated.previousStock,
        newStock: mutated.newStock,
        reason: `Purchase received (${claimed.purchaseNumber})`,
        notes: `Supplier: ${claimed.supplierName}`,
        referenceType: "PURCHASE",
        referenceId: claimed._id,
        referenceNumber: claimed.purchaseNumber,
        session,
      });
    }

    return claimed;
  });
}

export async function cancelPurchase(purchaseId: string, scope: StockScope) {
  const purchase = await Purchase.findOne({
    _id: purchaseId,
    businessId: scope.businessId,
  });
  if (!purchase) {
    throw new InventoryError("Purchase not found.", 404);
  }
  if (purchase.status === "RECEIVED") {
    throw new InventoryError(
      "Received purchases cannot be cancelled. Use a stock correction instead.",
      409,
    );
  }
  if (purchase.status === "CANCELLED") {
    throw new InventoryError("Purchase is already cancelled.", 409);
  }

  purchase.status = "CANCELLED";
  await purchase.save();
  return purchase;
}
