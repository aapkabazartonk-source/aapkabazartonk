import { Types } from "mongoose";
import { nextDailySequence } from "@/lib/document-numbers";
import {
  applyStockChange,
  InventoryError,
  withMongoTransaction,
} from "@/lib/inventory-stock";
import { multiplyMoney, roundMoney, sumMoney } from "@/lib/money";
import type { PurchaseCreateValues, PurchaseUpdateValues } from "@/lib/validators/purchase";
import { Product } from "@/models/Product";
import { Purchase, type IPurchaseItem } from "@/models/Purchase";

async function buildPurchaseItems(
  items: PurchaseCreateValues["items"],
  session?: import("mongoose").ClientSession,
) {
  const built: IPurchaseItem[] = [];

  for (const item of items) {
    const query = Product.findById(item.productId).select(
      "name sku isActive purchasePrice",
    );
    if (session) query.session(session);
    const product = await query;
    if (!product) {
      throw new InventoryError(`Product not found: ${item.productId}`, 404);
    }
    if (!product.isActive) {
      throw new InventoryError(
        `Product "${product.name}" is inactive and cannot be purchased.`,
        409,
      );
    }

    const lineGross = multiplyMoney(item.quantity, item.purchasePrice);
    const lineDiscount = roundMoney(item.discount ?? 0);
    const taxable = Math.max(0, roundMoney(lineGross - lineDiscount));
    const lineTax = roundMoney(taxable * ((item.taxRate ?? 0) / 100));
    const lineTotal = roundMoney(taxable + lineTax);

    built.push({
      product: product._id,
      productName: product.name,
      sku: product.sku,
      quantity: item.quantity,
      purchasePrice: item.purchasePrice,
      taxRate: item.taxRate ?? 0,
      discount: lineDiscount,
      total: lineTotal,
    });
  }

  return built;
}

function summarizeItems(
  items: IPurchaseItem[],
  headerDiscount = 0,
  headerTax = 0,
) {
  const itemsSubtotal = sumMoney(items.map((item) => item.total));
  const discount = roundMoney(headerDiscount);
  const tax = roundMoney(headerTax);
  const subtotal = itemsSubtotal;
  const total = Math.max(0, roundMoney(subtotal - discount + tax));
  return { subtotal, discount, tax, total };
}

export async function createPurchaseDraft(params: {
  data: PurchaseCreateValues;
  createdBy?: string | null;
}) {
  const { data, createdBy = null } = params;

  const items = await buildPurchaseItems(data.items);
  const totals = summarizeItems(items, data.discount ?? 0, data.tax ?? 0);

  const purchaseNumber = await nextDailySequence(
    async (prefix) =>
      Purchase.countDocuments({
        purchaseNumber: { $regex: `^${prefix}` },
      }),
    "PUR",
  );

  const purchase = await Purchase.create({
    purchaseNumber,
    supplierName: data.supplierName.trim(),
    supplierContact: (data.supplierContact ?? "").trim(),
    supplier: data.supplierId ? new Types.ObjectId(data.supplierId) : null,
    purchaseDate: data.purchaseDate ?? new Date(),
    expectedDeliveryDate: data.expectedDeliveryDate ?? null,
    items,
    ...totals,
    status: "DRAFT",
    notes: (data.notes ?? "").trim(),
    createdBy: createdBy ? new Types.ObjectId(createdBy) : null,
  });

  return purchase;
}

export async function updatePurchaseDraft(
  purchaseId: string,
  data: PurchaseUpdateValues,
) {
  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) {
    throw new InventoryError("Purchase not found.", 404);
  }
  if (purchase.status !== "DRAFT") {
    throw new InventoryError(
      "Only draft purchases can be edited. Received purchases require a dedicated correction process.",
      409,
    );
  }

  if (data.supplierName !== undefined) {
    purchase.supplierName = data.supplierName.trim();
  }
  if (data.supplierContact !== undefined) {
    purchase.supplierContact = data.supplierContact.trim();
  }
  if (data.supplierId !== undefined) {
    purchase.supplier = data.supplierId
      ? new Types.ObjectId(data.supplierId)
      : null;
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
    purchase.items = await buildPurchaseItems(data.items);
  }

  const totals = summarizeItems(
    purchase.items,
    data.discount ?? purchase.discount,
    data.tax ?? purchase.tax,
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
  performedBy?: string | null;
}) {
  const { purchaseId, performedBy = null } = params;

  return withMongoTransaction(async (session) => {
    const purchase = await Purchase.findById(purchaseId).session(session);
    if (!purchase) {
      throw new InventoryError("Purchase not found.", 404);
    }
    if (purchase.status === "RECEIVED") {
      throw new InventoryError("This purchase has already been received.", 409);
    }
    if (purchase.status === "CANCELLED") {
      throw new InventoryError("Cancelled purchases cannot be received.", 409);
    }
    if (purchase.status !== "DRAFT") {
      throw new InventoryError("Only draft purchases can be received.", 409);
    }

    const performedById = performedBy ? new Types.ObjectId(performedBy) : null;

    for (const item of purchase.items) {
      await applyStockChange({
        productId: item.product,
        quantity: item.quantity,
        movementType: "PURCHASE_RECEIVE",
        reason: `Purchase received (${purchase.purchaseNumber})`,
        notes: `Supplier: ${purchase.supplierName}`,
        referenceType: "PURCHASE",
        referenceId: purchase._id,
        performedBy: performedById,
        session,
      });
    }

    purchase.status = "RECEIVED";
    purchase.receivedAt = new Date();
    await purchase.save({ session });

    return purchase;
  });
}

export async function cancelPurchase(purchaseId: string) {
  const purchase = await Purchase.findById(purchaseId);
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
