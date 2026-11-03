export const PRODUCT_UNITS = [
  "piece",
  "kg",
  "gram",
  "litre",
  "ml",
  "box",
  "packet",
  "dozen",
  "metre",
] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export const STOCK_ADJUSTMENT_TYPES = [
  "STOCK_IN",
  "STOCK_OUT",
  "DAMAGED",
  "LOST",
  "CORRECTION",
  "OPENING_STOCK",
] as const;

export type StockAdjustmentType = (typeof STOCK_ADJUSTMENT_TYPES)[number];

/**
 * SALE and SALE_RETURN are reserved for Phase 4 POS billing.
 * They are accepted on inventory logs so history can show them later.
 * Phase 3 does not create these movements.
 */
export const FUTURE_SALE_MOVEMENT_TYPES = ["SALE", "SALE_RETURN"] as const;

export const INVENTORY_MOVEMENT_TYPES = [
  ...STOCK_ADJUSTMENT_TYPES,
  "PURCHASE_RECEIVE",
  ...FUTURE_SALE_MOVEMENT_TYPES,
] as const;

export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

export const STOCK_IN_MOVEMENT_TYPES = [
  "STOCK_IN",
  "OPENING_STOCK",
  "PURCHASE_RECEIVE",
  "SALE_RETURN",
] as const;

export const STOCK_OUT_MOVEMENT_TYPES = [
  "STOCK_OUT",
  "DAMAGED",
  "LOST",
  "SALE",
] as const;

export const INVENTORY_REFERENCE_TYPES = [
  "STOCK_ADJUSTMENT",
  "PURCHASE",
  "PRODUCT",
  "MANUAL",
  "SALE",
  "SALE_RETURN",
] as const;

export type InventoryReferenceType = (typeof INVENTORY_REFERENCE_TYPES)[number];

export const STOCK_ADJUSTMENT_STATUSES = ["COMPLETED", "CANCELLED"] as const;

export type StockAdjustmentStatus = (typeof STOCK_ADJUSTMENT_STATUSES)[number];

export const PURCHASE_STATUSES = ["DRAFT", "RECEIVED", "CANCELLED"] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const STOCK_STATUS_FILTERS = [
  "in_stock",
  "low_stock",
  "out_of_stock",
] as const;

export type StockStatusFilter = (typeof STOCK_STATUS_FILTERS)[number];
