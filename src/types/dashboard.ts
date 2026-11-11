import type { ComparedNumber } from "@/lib/analytics/finance";

export const DASHBOARD_PRESETS = [
  "today",
  "last_7_days",
  "last_30_days",
  "this_month",
] as const;

export type DashboardPreset = (typeof DASHBOARD_PRESETS)[number];

export type DashboardSalesPoint = {
  key: string;
  label: string;
  netSales: number;
  collected: number;
};

export type DashboardRecentSale = {
  id: string;
  invoiceNumber: string;
  saleNumber: string;
  createdAt: string;
  paymentMethod: string;
  paymentMethods: string[];
  grandTotal: number;
  href: string;
};

export type DashboardLowStockItem = {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  minStockLevel: number;
  href: string;
};

export type DashboardRecentPurchase = {
  id: string;
  purchaseNumber: string;
  supplierName: string;
  purchaseDate: string | null;
  receivedAt: string | null;
  createdAt: string;
  status: string;
  total: number;
  href: string;
};

export type DashboardTopProduct = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitsSold: number;
  revenue: number;
  href: string;
};

export type DashboardOverviewResponse = {
  generatedAt: string;
  timezone: string;
  range: {
    preset: DashboardPreset;
    from: string;
    to: string;
    label: string;
    previousLabel: string;
  };
  returnsNote: string;
  valuationMethod: string;
  valuationLabel: string;
  valuationNote: string;
  payablesNote: string;
  kpis: {
    todaySales: ComparedNumber;
    todayBills: ComparedNumber;
    averageBill: ComparedNumber;
    lowStockProducts: ComparedNumber;
    inventoryValue: ComparedNumber;
    supplierPayables: ComparedNumber;
  };
  kpiLinks: {
    todaySales: string;
    todayBills: string;
    averageBill: string;
    lowStockProducts: string;
    inventoryValue: string;
    supplierPayables: string;
  };
  salesTrend: {
    grain: string;
    points: DashboardSalesPoint[];
    netSales: ComparedNumber;
    collected: ComparedNumber;
  };
  recentSales: DashboardRecentSale[];
  lowStockAlerts: DashboardLowStockItem[];
  recentPurchases: DashboardRecentPurchase[];
  topProducts: DashboardTopProduct[];
};
