import mongoose, { Types, type ClientSession } from "mongoose";
import {
  STOCK_IN_MOVEMENT_TYPES,
  type InventoryMovementType,
  type InventoryReferenceType,
  type StockAdjustmentType,
  type UserRole,
} from "@/lib/constants";
import { nextDailySequence } from "@/lib/document-numbers";
import { InventoryLog } from "@/models/InventoryLog";
import { Product } from "@/models/Product";
import { StockAdjustment } from "@/models/StockAdjustment";

/**
 * Stock changes run only inside a MongoDB transaction.
 * There is no standalone fallback. Atlas (a replica set) is required.
 *
 * Updates use compare-and-swap on currentStock so two concurrent operations
 * cannot both apply a stale balance. Purchase receiving claims DRAFT status
 * with a conditional update so the same purchase cannot be received twice.
 */
export class InventoryError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "INVENTORY_ERROR") {
    super(message);
    this.name = "InventoryError";
    this.status = status;
    this.code = code;
  }
}

const INCREASING = new Set<string>(STOCK_IN_MOVEMENT_TYPES);

export function isStockIncreasing(type: InventoryMovementType | StockAdjustmentType) {
  return INCREASING.has(type);
}

export type StockScope = {
  businessId: Types.ObjectId;
  storeId: Types.ObjectId;
  performedBy?: Types.ObjectId | null;
  role?: UserRole | null;
};

export function scopeFromTenant(tenant: {
  businessId: Types.ObjectId;
  storeId: Types.ObjectId;
  userId: string | null;
  role?: UserRole | null;
}): StockScope {
  return {
    businessId: tenant.businessId,
    storeId: tenant.storeId,
    performedBy: tenant.userId ? new Types.ObjectId(tenant.userId) : null,
    role: tenant.role ?? "owner",
  };
}

export function computeNextStock(params: {
  previousStock: number;
  quantity: number;
  movementType: InventoryMovementType;
}) {
  const { previousStock, quantity, movementType } = params;
  let newStock: number;
  let loggedQuantity: number;

  if (movementType === "CORRECTION") {
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new InventoryError("Corrected stock cannot be negative.");
    }
    newStock = quantity;
    loggedQuantity = Math.abs(newStock - previousStock);
  } else if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new InventoryError("Quantity must be greater than 0.");
  } else if (isStockIncreasing(movementType)) {
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
      "INSUFFICIENT_STOCK",
    );
  }

  return { previousStock, newStock, loggedQuantity, movementType };
}

export async function withMongoTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } catch (error) {
      lastError = mapTransactionError(error);
      const code = lastError instanceof InventoryError ? lastError.code : "";
      const retryable =
        code === "STOCK_CONFLICT" || isDuplicateDocumentNumber(error);
      if (retryable && attempt < 7) {
        continue;
      }
      throw lastError;
    } finally {
      await session.endSession();
    }
  }

  throw lastError;
}

function mapTransactionError(error: unknown) {
  if (error instanceof InventoryError) return error;
  if (
    error instanceof Error &&
    /Transaction numbers are only allowed|replica set|mongos/i.test(error.message)
  ) {
    return new InventoryError(
      "Stock-changing operations require a MongoDB replica set. Use MongoDB Atlas or another replica set. Stock was not changed.",
      503,
      "TRANSACTIONS_UNAVAILABLE",
    );
  }
  return error;
}

export function duplicateKeyPattern(error: unknown): Record<string, number> | null {
  const candidates: unknown[] = [error];
  if (typeof error === "object" && error && "cause" in error) {
    candidates.push((error as { cause?: unknown }).cause);
  }

  for (const candidate of candidates) {
    if (
      typeof candidate === "object" &&
      candidate !== null &&
      "code" in candidate &&
      (candidate as { code?: number }).code === 11000
    ) {
      return (
        (candidate as { keyPattern?: Record<string, number> }).keyPattern ?? {}
      );
    }
  }

  return null;
}

function isDuplicateDocumentNumber(error: unknown) {
  const pattern = duplicateKeyPattern(error);
  if (!pattern) return false;
  return (
    "adjustmentNumber" in pattern ||
    "purchaseNumber" in pattern ||
    "saleNumber" in pattern ||
    "invoiceNumber" in pattern
  );
}

export function isIdempotencyConflict(error: unknown) {
  const pattern = duplicateKeyPattern(error);
  return Boolean(pattern && "idempotencyKey" in pattern);
}

export async function mutateProductStock(params: {
  scope: StockScope;
  productId: string | Types.ObjectId;
  quantity: number;
  movementType: InventoryMovementType;
  session: ClientSession;
}) {
  const { scope, productId, quantity, movementType, session } = params;

  const product = await Product.findOne({
    _id: productId,
    businessId: scope.businessId,
  }).session(session);

  if (!product) {
    throw new InventoryError("Product not found.", 404, "PRODUCT_NOT_FOUND");
  }

  if (!product.isActive && movementType === "PURCHASE_RECEIVE") {
    throw new InventoryError(
      `Product "${product.name}" is inactive and cannot receive purchase stock.`,
      409,
      "PRODUCT_INACTIVE",
    );
  }

  const math = computeNextStock({
    previousStock: product.currentStock,
    quantity,
    movementType,
  });

  const delta =
    movementType === "CORRECTION"
      ? math.newStock - math.previousStock
      : isStockIncreasing(movementType)
        ? quantity
        : -quantity;

  const updated = await Product.findOneAndUpdate(
    {
      _id: product._id,
      businessId: scope.businessId,
      currentStock: math.previousStock,
    },
    { $inc: { currentStock: delta } },
    { session, returnDocument: "after" },
  );

  if (!updated) {
    throw new InventoryError(
      "Stock was updated by another operation. Please retry.",
      409,
      "STOCK_CONFLICT",
    );
  }

  if (updated.currentStock < 0) {
    throw new InventoryError(
      `Insufficient stock for "${product.name}".`,
      409,
      "INSUFFICIENT_STOCK",
    );
  }

  if (movementType === "CORRECTION" && math.loggedQuantity === 0) {
    throw new InventoryError("Stock is already at that level.");
  }

  return {
    product: updated,
    previousStock: math.previousStock,
    newStock: updated.currentStock,
    loggedQuantity: Math.abs(updated.currentStock - math.previousStock),
  };
}

export async function writeInventoryLog(params: {
  scope: StockScope;
  productId: Types.ObjectId;
  movementType: InventoryMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  notes?: string;
  referenceType: InventoryReferenceType;
  referenceId?: Types.ObjectId | null;
  referenceNumber?: string;
  session: ClientSession;
}) {
  const [log] = await InventoryLog.create(
    [
      {
        businessId: params.scope.businessId,
        storeId: params.scope.storeId,
        product: params.productId,
        movementType: params.movementType,
        quantity: params.quantity,
        previousStock: params.previousStock,
        newStock: params.newStock,
        reason: params.reason.trim(),
        referenceType: params.referenceType,
        referenceId: params.referenceId ?? null,
        referenceNumber: (params.referenceNumber ?? "").trim(),
        notes: (params.notes ?? "").trim(),
        performedBy: params.scope.performedBy ?? null,
      },
    ],
    { session: params.session },
  );

  return log;
}

async function nextAdjustmentNumber(
  businessId: Types.ObjectId,
  session: ClientSession,
) {
  return nextDailySequence(
    async (prefix) =>
      StockAdjustment.countDocuments({
        businessId,
        adjustmentNumber: { $regex: `^${prefix}` },
      }).session(session),
    "ADJ",
  );
}

export async function findIdempotentAdjustment(
  businessId: Types.ObjectId,
  idempotencyKey: string,
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await StockAdjustment.findOne({
      businessId,
      idempotencyKey,
    });
    if (existing) return existing;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  return null;
}

export async function createStockAdjustment(params: {
  scope: StockScope;
  productId: string;
  adjustmentType: StockAdjustmentType;
  quantity: number;
  reason: string;
  notes?: string;
  referenceNumber?: string;
  idempotencyKey?: string | null;
}) {
  const {
    scope,
    productId,
    adjustmentType,
    quantity,
    reason,
    notes = "",
    referenceNumber = "",
    idempotencyKey,
  } = params;

  if (!reason.trim()) {
    throw new InventoryError("A reason is required for stock adjustments.");
  }

  const key = idempotencyKey?.trim() || "";
  if (key) {
    const existing = await StockAdjustment.findOne({
      businessId: scope.businessId,
      idempotencyKey: key,
    });
    if (existing) return { adjustment: existing, replayed: true };
  }

  try {
    const adjustment = await withMongoTransaction(async (session) => {
      if (key) {
        const existing = await StockAdjustment.findOne({
          businessId: scope.businessId,
          idempotencyKey: key,
        }).session(session);
        if (existing) return existing;
      }

      const mutated = await mutateProductStock({
        scope,
        productId,
        quantity,
        movementType: adjustmentType,
        session,
      });

      const adjustmentNumber = await nextAdjustmentNumber(
        scope.businessId,
        session,
      );

      const [created] = await StockAdjustment.create(
        [
          {
            businessId: scope.businessId,
            storeId: scope.storeId,
            adjustmentNumber,
            idempotencyKey: key || undefined,
            product: mutated.product._id,
            adjustmentType,
            quantity,
            previousStock: mutated.previousStock,
            newStock: mutated.newStock,
            reason: reason.trim(),
            notes: notes.trim(),
            referenceNumber: referenceNumber.trim(),
            status: "COMPLETED",
            createdBy: scope.performedBy ?? null,
          },
        ],
        { session },
      );

      await writeInventoryLog({
        scope,
        productId: mutated.product._id,
        movementType: adjustmentType,
        quantity: mutated.loggedQuantity,
        previousStock: mutated.previousStock,
        newStock: mutated.newStock,
        reason: reason.trim(),
        notes: notes.trim(),
        referenceType: "STOCK_ADJUSTMENT",
        referenceId: created._id,
        referenceNumber: referenceNumber.trim() || adjustmentNumber,
        session,
      });

      return created;
    });

    return { adjustment, replayed: false };
  } catch (error) {
    if (key && isIdempotencyConflict(error)) {
      const existing = await findIdempotentAdjustment(scope.businessId, key);
      if (existing) return { adjustment: existing, replayed: true };
    }
    throw error;
  }
}

export async function createProductWithOpeningStock(params: {
  productData: Record<string, unknown>;
  openingStock: number;
  scope: StockScope;
}) {
  const { productData, openingStock, scope } = params;

  return withMongoTransaction(async (session) => {
    const [product] = await Product.create(
      [
        {
          ...productData,
          businessId: scope.businessId,
          storeId: scope.storeId,
          currentStock: 0,
        },
      ],
      { session },
    );

    if (openingStock > 0) {
      const mutated = await mutateProductStock({
        scope,
        productId: product._id,
        quantity: openingStock,
        movementType: "OPENING_STOCK",
        session,
      });

      const adjustmentNumber = await nextAdjustmentNumber(
        scope.businessId,
        session,
      );

      const [adjustment] = await StockAdjustment.create(
        [
          {
            businessId: scope.businessId,
            storeId: scope.storeId,
            adjustmentNumber,
            product: product._id,
            adjustmentType: "OPENING_STOCK",
            quantity: openingStock,
            previousStock: mutated.previousStock,
            newStock: mutated.newStock,
            reason: "Opening stock on product creation",
            notes: "",
            referenceNumber: "",
            status: "COMPLETED",
            createdBy: scope.performedBy ?? null,
          },
        ],
        { session },
      );

      await writeInventoryLog({
        scope,
        productId: product._id,
        movementType: "OPENING_STOCK",
        quantity: mutated.loggedQuantity,
        previousStock: mutated.previousStock,
        newStock: mutated.newStock,
        reason: "Opening stock on product creation",
        notes: `Linked adjustment ${adjustment.adjustmentNumber}`,
        referenceType: "STOCK_ADJUSTMENT",
        referenceId: adjustment._id,
        referenceNumber: adjustment.adjustmentNumber,
        session,
      });
    }

    return product;
  });
}
