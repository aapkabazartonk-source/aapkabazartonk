import type { CostStatus } from "@/lib/analytics/finance";

export type ComparedNumber = {
  current: number | null;
  previous: number | null;
  delta: number | null;
  percent: number | null;
  comparable: boolean;
};

export type AnalyticsRangeMeta = {
  preset: string;
  from: string;
  to: string;
  label: string;
};

export type AnalyticsMeta = {
  generatedAt: string;
  timezone: "Asia/Kolkata";
  range: AnalyticsRangeMeta;
  previousRange: {
    from: string;
    to: string;
    label: string;
  };
};

export type AnalyticsProductRow = {
  productId: string;
  name: string;
  sku: string;
  category: string;
  image: string | null;
  quantity: number;
  revenue: number;
  grossProfit: number | null;
  costStatus: CostStatus;
  currentStock: number | null;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type RevenuePoint = {
  key: string;
  label: string;
  current: number | null;
  previous: number | null;
};

export type CategoryPoint = {
  name: string;
  revenue: number;
  units: number;
  share: number | null;
};

export type PaymentSlice = {
  method: string;
  label: string;
  amount: number;
  percent: number | null;
};

export type TrendPoint = {
  key: string;
  label: string;
  amount: number;
};

export type PurchaseSalesPoint = {
  key: string;
  label: string;
  purchases: number;
  sales: number;
};
