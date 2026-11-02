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

export const INVENTORY_MOVEMENT_TYPES = [
  ...STOCK_ADJUSTMENT_TYPES,
  "PURCHASE_RECEIVE",
] as const;

export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

export const INVENTORY_REFERENCE_TYPES = [
  "STOCK_ADJUSTMENT",
  "PURCHASE",
  "PRODUCT",
  "MANUAL",
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
