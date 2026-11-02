import mongoose, { Types, type ClientSession } from "mongoose";
import type { InventoryMovementType, StockAdjustmentType } from "@/lib/constants";
import { nextDailySequence } from "@/lib/document-numbers";
import { InventoryLog } from "@/models/InventoryLog";
import { Product } from "@/models/Product";
import { StockAdjustment } from "@/models/StockAdjustment";

export class InventoryError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "InventoryError";
    this.status = status;
  }
}

export function isStockIncreasing(type: StockAdjustmentType | InventoryMovementType) {
  return type === "STOCK_IN" || type === "OPENING_STOCK" || type === "PURCHASE_RECEIVE";
}

export function computeNextStock(params: {
  previousStock: number;
  quantity: number;
  adjustmentType: StockAdjustmentType;
}) {
  const { previousStock, quantity, adjustmentType } = params;

  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new InventoryError("Quantity must be a non-negative number.");
  }

  let newStock: number;
  let loggedQuantity: number;

  if (adjustmentType === "CORRECTION") {
    newStock = quantity;
    loggedQuantity = Math.abs(newStock - previousStock);
  } else if (isStockIncreasing(adjustmentType)) {
    newStock = previousStock + quantity;
    loggedQuantity = quantity;
  } else {
    newStock = previousStock - quantity;
    loggedQuantity = quantity;
  }

  if (newStock < 0) {
    throw new InventoryError(
      `Insufficient stock. Available: ${previousStock}, requested: ${quantity}.`,
      409,
    );
  }

  return {
    previousStock,
    newStock,
    loggedQuantity,
    movementType: adjustmentType as InventoryMovementType,
  };
}

export async function withMongoTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("Transaction numbers are only allowed") ||
        error.message.includes("replica set") ||
        error.message.includes("mongos"))
    ) {
      throw new InventoryError(
        "Stock-changing operations require a MongoDB replica set (e.g. Atlas). Local standalone MongoDB does not support transactions.",
        503,
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

type ApplyStockChangeInput = {
  productId: string | Types.ObjectId;
  quantity: number;
  movementType: InventoryMovementType;
  reason: string;
  notes?: string;
  referenceType: "STOCK_ADJUSTMENT" | "PURCHASE" | "PRODUCT" | "MANUAL";
  referenceId?: Types.ObjectId | null;
  performedBy?: Types.ObjectId | null;
  session: ClientSession;
  /** When set, treat quantity as absolute stock (for CORRECTION semantics already computed). */
  absoluteNewStock?: number;
};

export async function applyStockChange(input: ApplyStockChangeInput) {
  const {
    productId,
    quantity,
    movementType,
    reason,
    notes = "",
    referenceType,
    referenceId = null,
    performedBy = null,
    session,
    absoluteNewStock,
  } = input;

  const product = await Product.findById(productId).session(session);
  if (!product) {
    throw new InventoryError("Product not found.", 404);
  }
  if (!product.isActive && movementType === "PURCHASE_RECEIVE") {
    throw new InventoryError(
      `Product "${product.name}" is inactive and cannot receive purchase stock.`,
      409,
    );
  }

  const previousStock = product.currentStock;
  let newStock: number;
  let loggedQuantity: number;

  if (absoluteNewStock !== undefined) {
    newStock = absoluteNewStock;
    loggedQuantity = Math.abs(newStock - previousStock);
  } else if (isStockIncreasing(movementType)) {
    newStock = previousStock + quantity;
    loggedQuantity = quantity;
  } else if (movementType === "CORRECTION") {
    newStock = quantity;
    loggedQuantity = Math.abs(newStock - previousStock);
  } else {
    newStock = previousStock - quantity;
    loggedQuantity = quantity;
  }

  if (newStock < 0) {
    throw new InventoryError(
      `Insufficient stock for "${product.name}". Available: ${previousStock}, requested: ${quantity}.`,
      409,
    );
  }

  product.currentStock = newStock;
  await product.save({ session });

  const [log] = await InventoryLog.create(
    [
      {
        product: product._id,
        movementType,
        quantity: loggedQuantity,
        previousStock,
        newStock,
        reason,
        referenceType,
        referenceId,
        notes,
        performedBy,
      },
    ],
    { session },
  );

  return { product, log, previousStock, newStock, loggedQuantity };
}

export async function createStockAdjustment(params: {
  productId: string;
  adjustmentType: StockAdjustmentType;
  quantity: number;
  reason: string;
  notes?: string;
  referenceNumber?: string;
  createdBy?: string | null;
}) {
  const {
    productId,
    adjustmentType,
    quantity,
    reason,
    notes = "",
    referenceNumber = "",
    createdBy = null,
  } = params;

  if (!reason.trim()) {
    throw new InventoryError("A reason is required for stock adjustments.");
  }

  return withMongoTransaction(async (session) => {
    const product = await Product.findById(productId).session(session);
    if (!product) {
      throw new InventoryError("Product not found.", 404);
    }

    const result = computeNextStock({
      previousStock: product.currentStock,
      quantity,
      adjustmentType,
    });

    const adjustmentNumber = await nextDailySequence(
      async (prefix) =>
        StockAdjustment.countDocuments({
          adjustmentNumber: { $regex: `^${prefix}` },
        }).session(session),
      "ADJ",
    );

    const createdById = createdBy ? new Types.ObjectId(createdBy) : null;

    const [adjustment] = await StockAdjustment.create(
      [
        {
          adjustmentNumber,
          product: product._id,
          adjustmentType,
          quantity,
          previousStock: result.previousStock,
          newStock: result.newStock,
          reason: reason.trim(),
          notes: notes.trim(),
          referenceNumber: referenceNumber.trim(),
          status: "COMPLETED",
          createdBy: createdById,
        },
      ],
      { session },
    );

    product.currentStock = result.newStock;
    await product.save({ session });

    await InventoryLog.create(
      [
        {
          product: product._id,
          movementType: result.movementType,
          quantity: result.loggedQuantity,
          previousStock: result.previousStock,
          newStock: result.newStock,
          reason: reason.trim(),
          referenceType: "STOCK_ADJUSTMENT",
          referenceId: adjustment._id,
          notes: notes.trim(),
          performedBy: createdById,
        },
      ],
      { session },
    );

    return adjustment;
  });
}

export async function createProductWithOpeningStock(params: {
  productData: Record<string, unknown>;
  openingStock: number;
  createdBy?: string | null;
}) {
  const { productData, openingStock, createdBy = null } = params;

  return withMongoTransaction(async (session) => {
    const [product] = await Product.create(
      [
        {
          ...productData,
          currentStock: 0,
        },
      ],
      { session },
    );

    if (openingStock > 0) {
      const createdById = createdBy ? new Types.ObjectId(createdBy) : null;
      const adjustmentNumber = await nextDailySequence(
        async (prefix) =>
          StockAdjustment.countDocuments({
            adjustmentNumber: { $regex: `^${prefix}` },
          }).session(session),
        "ADJ",
      );

      const [adjustment] = await StockAdjustment.create(
        [
          {
            adjustmentNumber,
            product: product._id,
            adjustmentType: "OPENING_STOCK",
            quantity: openingStock,
            previousStock: 0,
            newStock: openingStock,
            reason: "Opening stock on product creation",
            notes: "",
            referenceNumber: "",
            status: "COMPLETED",
            createdBy: createdById,
          },
        ],
        { session },
      );

      product.currentStock = openingStock;
      await product.save({ session });

      await InventoryLog.create(
        [
          {
            product: product._id,
            movementType: "OPENING_STOCK",
            quantity: openingStock,
            previousStock: 0,
            newStock: openingStock,
            reason: "Opening stock on product creation",
            referenceType: "PRODUCT",
            referenceId: product._id,
            notes: `Linked adjustment ${adjustment.adjustmentNumber}`,
            performedBy: createdById,
          },
        ],
        { session },
      );
    }

    return product;
  });
}
