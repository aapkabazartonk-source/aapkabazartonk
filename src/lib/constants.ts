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

export const PAYMENT_METHODS = [
  "CASH",
  "UPI",
  "CARD",
  "BANK_TRANSFER",
  "CREDIT",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Methods a cashier can tender. Credit is calculated from the unpaid balance. */
export const TENDER_METHODS = [
  "CASH",
  "UPI",
  "CARD",
  "BANK_TRANSFER",
] as const;

export type TenderMethod = (typeof TENDER_METHODS)[number];

export const PAYMENT_RECORD_STATUSES = [
  "CONFIRMED",
  "MANUALLY_CONFIRMED",
  "CREDIT",
] as const;

export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number];

/** No gateway verification exists. UPI and transfers stay manual. */
export const PAYMENT_VERIFICATIONS = ["NOT_APPLICABLE", "MANUAL"] as const;

export type PaymentVerification = (typeof PAYMENT_VERIFICATIONS)[number];

export const SALE_PAYMENT_STATUSES = ["PAID", "PARTIAL", "UNPAID"] as const;

export type SalePaymentStatus = (typeof SALE_PAYMENT_STATUSES)[number];

/** Purchase payable status mirrored from Sale payment statuses. */
export const PURCHASE_PAYMENT_STATUSES = ["PAID", "PARTIAL", "UNPAID"] as const;

export type PurchasePaymentStatus = (typeof PURCHASE_PAYMENT_STATUSES)[number];

/** Methods allowed when paying a supplier (payable side). */
export const SUPPLIER_PAYMENT_METHODS = [
  "CASH",
  "UPI",
  "BANK_TRANSFER",
  "CHEQUE",
] as const;

export type SupplierPaymentMethod = (typeof SUPPLIER_PAYMENT_METHODS)[number];

/**
 * Supplier ledger entry types.
 * Sign convention: debit increases payable; credit decreases payable.
 * Positive running balance = amount payable to supplier.
 */
export const SUPPLIER_LEDGER_ENTRY_TYPES = [
  "OPENING",
  "PURCHASE",
  "PAYMENT",
  "ADJUSTMENT",
] as const;

export type SupplierLedgerEntryType =
  (typeof SUPPLIER_LEDGER_ENTRY_TYPES)[number];

export const SUPPLIER_LEDGER_REFERENCE_TYPES = [
  "SUPPLIER",
  "PURCHASE",
  "SUPPLIER_PAYMENT",
  "ADJUSTMENT",
] as const;

export type SupplierLedgerReferenceType =
  (typeof SUPPLIER_LEDGER_REFERENCE_TYPES)[number];

export const SALE_STATUSES = ["COMPLETED"] as const;

export type SaleStatus = (typeof SALE_STATUSES)[number];

export const INVOICE_TYPES = ["TAX_INVOICE", "BILL_OF_SUPPLY"] as const;

export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const SUPPLY_TYPES = ["INTRA", "INTER"] as const;

export type SupplyType = (typeof SUPPLY_TYPES)[number];

export const HELD_CART_STATUSES = ["HELD", "RESUMED", "DISCARDED"] as const;

export type HeldCartStatus = (typeof HELD_CART_STATUSES)[number];

/** Phase 6 roles. `viewer` is legacy and treated as cashier for permissions. */
export const USER_ROLES = ["owner", "admin", "manager", "cashier", "viewer"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const SETTINGS_PERMISSIONS = [
  "products.manage",
  "inventory.adjust",
  "purchases.manage",
  "pos.bill",
  "pos.discount_override",
  "sales.cancel",
  "reports.view",
  "settings.manage",
  "users.manage",
] as const;

export type SettingsPermission = (typeof SETTINGS_PERMISSIONS)[number];

export const INVOICE_PAPER_SIZES = ["58mm", "80mm", "A4", "6x4"] as const;

export type InvoicePaperSize = (typeof INVOICE_PAPER_SIZES)[number];

export const BUSINESS_TYPES = [
  "retail",
  "wholesale",
  "kirana",
  "pharmacy",
  "electronics",
  "other",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];
