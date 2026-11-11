import type { PaginationMeta } from "@/types/catalog";

export type InventoryMovementType =
  | "STOCK_IN"
  | "STOCK_OUT"
  | "DAMAGED"
  | "LOST"
  | "CORRECTION"
  | "OPENING_STOCK"
  | "PURCHASE_RECEIVE";

export type PurchaseStatus = "DRAFT" | "RECEIVED" | "CANCELLED";

export interface InventoryOverviewResponse {
  data: {
    stats: {
      totalProducts: number;
      totalStockUnits: number;
      totalInventoryValue: number;
      inStockProducts: number;
      lowStockProducts: number;
      outOfStockProducts: number;
    };
    charts: {
      stockMovementTrend: Array<{
        date: string;
        stockIn: number;
        stockOut: number;
      }>;
      stockByCategory: Array<{ name: string; value: number; fill: string }>;
      valuationByCategory: Array<{ name: string; value: number; fill: string }>;
    };
    lowStockAlerts: Array<Record<string, unknown>>;
    outOfStockProducts: Array<Record<string, unknown>>;
    recentMovements: Array<Record<string, unknown>>;
    recentAdjustments: Array<Record<string, unknown>>;
    recentPurchases: Array<Record<string, unknown>>;
    reorderMultiple: number;
  };
}

export interface InventoryHistoryResponse {
  data: Array<Record<string, unknown>>;
  pagination: PaginationMeta;
}

export interface InventoryAlertsResponse {
  data: Array<Record<string, unknown>>;
  pagination: PaginationMeta;
  stats: {
    lowStockProducts: number;
    outOfStockProducts: number;
    totalAlerts: number;
    reorderMultiple: number;
  };
}

export interface PurchaseRecord {
  _id: string;
  purchaseNumber: string;
  supplierName: string;
  supplierContact?: string;
  supplierInvoiceNumber?: string;
  supplierGstin?: string;
  supplier?: string | { _id: string; name?: string; phone?: string } | null;
  purchaseDate: string;
  expectedDeliveryDate?: string | null;
  items: Array<{
    product: string;
    productName: string;
    productNameSnapshot?: string;
    sku: string;
    skuSnapshot?: string;
    quantity: number;
    purchasePrice: number;
    taxRate: number;
    discount: number;
    taxAmount?: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: PurchaseStatus;
  amountPaid?: number;
  balanceDue?: number;
  paymentStatus?: "UNPAID" | "PARTIAL" | "PAID";
  notes?: string;
  receivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseListResponse {
  data: PurchaseRecord[];
  pagination: PaginationMeta;
  stats: {
    draftCount: number;
    receivedCount: number;
    cancelledCount: number;
    totalPurchases: number;
  };
}
