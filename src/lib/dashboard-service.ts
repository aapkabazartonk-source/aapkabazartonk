import {
  COLLECTED_PAYMENT_STATUSES,
  INVENTORY_VALUATION_LABEL,
  INVENTORY_VALUATION_METHOD,
  PAYABLES_NOTE,
  RECOGNIZED_SALE_STATUS,
  RETURNS_NOTE,
  VALUATION_NOTE,
  compareNumbers,
  isCollectedPayment,
  roundQty,
} from "@/lib/analytics/finance";
import {
  averageBill,
  loadHeader,
  loadInventoryValue,
  loadLines,
  loadPayables,
  loadPayments,
  type AnalyticsScope,
} from "@/lib/analytics/service";
import {
  BUSINESS_TIMEZONE,
  bucketLabel,
  defaultGrain,
  enumerateBuckets,
  resolveRange,
  type AnalyticsGrain,
} from "@/lib/analytics/time";
import { roundMoney } from "@/lib/money";
import { Payment } from "@/models/Payment";
import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";
import { Sale } from "@/models/Sale";
import {
  DASHBOARD_PRESETS,
  type DashboardOverviewResponse,
  type DashboardPreset,
  type DashboardRecentSale,
  type DashboardSalesPoint,
} from "@/types/dashboard";

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  CREDIT: "Credit",
};

const LIST_LIMIT = 8;
const TOP_PRODUCTS_LIMIT = 5;

export class DashboardError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "DashboardError";
    this.status = status;
  }
}

function snapshotMetric(current: number) {
  return compareNumbers(current, null);
}

function dateFormat(grain: AnalyticsGrain) {
  if (grain === "hour") return "%Y-%m-%dT%H";
  if (grain === "day") return "%Y-%m-%d";
  if (grain === "week") return "%G-W%V";
  return "%Y-%m";
}

function saleMatch(scope: AnalyticsScope, from: Date, to: Date) {
  return {
    businessId: scope.businessId,
    storeId: scope.storeId,
    saleStatus: RECOGNIZED_SALE_STATUS,
    createdAt: { $gte: from, $lt: to },
  };
}

function paymentMethodLabel(methods: string[]) {
  const unique = [...new Set(methods.filter(Boolean))];
  if (unique.length === 0) return "—";
  if (unique.length === 1) return METHOD_LABEL[unique[0]] ?? unique[0];
  const nonCredit = unique.filter((method) => method !== "CREDIT");
  if (nonCredit.length === 1) {
    return METHOD_LABEL[nonCredit[0]] ?? nonCredit[0];
  }
  return "Mixed";
}

export function parseDashboardPreset(
  value: string | null | undefined,
): DashboardPreset {
  if (value && (DASHBOARD_PRESETS as readonly string[]).includes(value)) {
    return value as DashboardPreset;
  }
  if (!value) return "last_7_days";
  throw new DashboardError(
    "Choose Today, Last 7 days, Last 30 days, or This month.",
  );
}

async function loadNetSalesBuckets(
  scope: AnalyticsScope,
  from: Date,
  to: Date,
  grain: AnalyticsGrain,
) {
  const rows = await Sale.aggregate<{ _id: string; amount: number }>([
    { $match: saleMatch(scope, from, to) },
    {
      $group: {
        _id: {
          $dateToString: {
            format: dateFormat(grain),
            date: "$createdAt",
            timezone: BUSINESS_TIMEZONE,
          },
        },
        amount: { $sum: "$taxableAmount" },
      },
    },
  ]);
  return new Map(rows.map((row) => [row._id, roundMoney(row.amount)]));
}

async function loadCollectedBuckets(
  scope: AnalyticsScope,
  from: Date,
  to: Date,
  grain: AnalyticsGrain,
) {
  const rows = await Payment.aggregate<{ _id: string; amount: number }>([
    {
      $match: {
        businessId: scope.businessId,
        storeId: scope.storeId,
        createdAt: { $gte: from, $lt: to },
        status: { $in: [...COLLECTED_PAYMENT_STATUSES] },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: dateFormat(grain),
            date: "$createdAt",
            timezone: BUSINESS_TIMEZONE,
          },
        },
        amount: { $sum: "$amount" },
      },
    },
  ]);
  return new Map(rows.map((row) => [row._id, roundMoney(row.amount)]));
}

async function loadSalesTrend(
  scope: AnalyticsScope,
  from: Date,
  to: Date,
  grain: AnalyticsGrain,
  now: Date,
): Promise<DashboardSalesPoint[]> {
  const [netMap, collectedMap] = await Promise.all([
    loadNetSalesBuckets(scope, from, to, grain),
    loadCollectedBuckets(scope, from, to, grain),
  ]);
  const keys = enumerateBuckets(from, to, grain, now);
  return keys.map((key) => ({
    key,
    label: bucketLabel(key, grain),
    netSales: netMap.get(key) ?? 0,
    collected: collectedMap.get(key) ?? 0,
  }));
}

async function loadRecentSales(
  scope: AnalyticsScope,
): Promise<DashboardRecentSale[]> {
  const sales = await Sale.find({
    businessId: scope.businessId,
    storeId: scope.storeId,
    saleStatus: RECOGNIZED_SALE_STATUS,
  })
    .sort({ createdAt: -1 })
    .limit(LIST_LIMIT)
    .select("invoiceNumber saleNumber grandTotal createdAt")
    .lean();

  if (sales.length === 0) return [];

  const saleIds = sales.map((sale) => sale._id);
  const payments = await Payment.find({
    businessId: scope.businessId,
    sale: { $in: saleIds },
  })
    .sort({ sequence: 1 })
    .select("sale paymentMethod amount status")
    .lean();

  const methodsBySale = new Map<string, string[]>();
  for (const payment of payments) {
    const key = String(payment.sale);
    const list = methodsBySale.get(key) ?? [];
    if (isCollectedPayment(payment.status) || payment.status === "CREDIT") {
      list.push(payment.paymentMethod);
    }
    methodsBySale.set(key, list);
  }

  return sales.map((sale) => {
    const id = String(sale._id);
    const methods = methodsBySale.get(id) ?? [];
    return {
      id,
      invoiceNumber: sale.invoiceNumber,
      saleNumber: sale.saleNumber,
      createdAt: sale.createdAt.toISOString(),
      paymentMethod: paymentMethodLabel(methods),
      paymentMethods: methods,
      grandTotal: roundMoney(sale.grandTotal),
      href: `/dashboard/sales/${id}`,
    };
  });
}

async function loadLowStock(scope: AnalyticsScope) {
  const [count, alerts] = await Promise.all([
    Product.countDocuments({
      businessId: scope.businessId,
      isActive: true,
      $expr: { $lte: ["$currentStock", "$minStockLevel"] },
    }),
    Product.find({
      businessId: scope.businessId,
      isActive: true,
      $expr: { $lte: ["$currentStock", "$minStockLevel"] },
    })
      .sort({ currentStock: 1, name: 1 })
      .limit(LIST_LIMIT)
      .select("name sku currentStock minStockLevel")
      .lean(),
  ]);

  return {
    count,
    alerts: alerts.map((product) => ({
      id: String(product._id),
      name: product.name,
      sku: product.sku,
      currentStock: Number(product.currentStock ?? 0),
      minStockLevel: Number(product.minStockLevel ?? 0),
      href: `/dashboard/inventory/alerts`,
    })),
  };
}

async function loadRecentPurchases(scope: AnalyticsScope) {
  const purchases = await Purchase.find({
    businessId: scope.businessId,
    storeId: scope.storeId,
  })
    .sort({ createdAt: -1 })
    .limit(LIST_LIMIT)
    .select(
      "purchaseNumber supplierName purchaseDate receivedAt createdAt status total",
    )
    .lean();

  return purchases.map((purchase) => ({
    id: String(purchase._id),
    purchaseNumber: purchase.purchaseNumber,
    supplierName: purchase.supplierName || "—",
    purchaseDate: purchase.purchaseDate
      ? new Date(purchase.purchaseDate).toISOString()
      : null,
    receivedAt: purchase.receivedAt
      ? new Date(purchase.receivedAt).toISOString()
      : null,
    createdAt: purchase.createdAt.toISOString(),
    status: purchase.status,
    total: roundMoney(purchase.total),
    href: `/dashboard/purchases`,
  }));
}

async function loadTopProducts(
  scope: AnalyticsScope,
  from: Date,
  to: Date,
) {
  const lines = await loadLines(scope, from, to);
  const ranked = [...lines]
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, TOP_PRODUCTS_LIMIT);

  if (ranked.length === 0) return [];

  const products = await Product.find({
    businessId: scope.businessId,
    _id: { $in: ranked.map((line) => line.productId) },
  })
    .select("name sku category")
    .populate("category", "name")
    .lean<
      Array<{
        _id: { toString(): string };
        name?: string;
        sku?: string;
        category?: { name?: string } | null;
      }>
    >();

  const byId = new Map(products.map((product) => [String(product._id), product]));

  return ranked.map((line) => {
    const product = byId.get(line.productId);
    const categoryName =
      product?.category &&
      typeof product.category === "object" &&
      typeof product.category.name === "string"
        ? product.category.name
        : "";
    return {
      id: line.productId,
      name: product?.name || line.name,
      sku: product?.sku || line.sku,
      category: categoryName,
      unitsSold: roundQty(line.quantity),
      revenue: roundMoney(line.revenue),
      href: `/dashboard/products`,
    };
  });
}

export async function getDashboardOverview(
  scope: AnalyticsScope,
  preset: DashboardPreset,
  now = new Date(),
): Promise<DashboardOverviewResponse> {
  const range = resolveRange({ preset, now });
  const today = resolveRange({ preset: "today", now });
  const grain = defaultGrain(range.from, range.to);

  const [
    todayHeader,
    yesterdayHeader,
    rangeHeader,
    previousRangeHeader,
    rangePayments,
    previousRangePayments,
    inventoryValue,
    payables,
    lowStock,
    salesTrend,
    recentSales,
    recentPurchases,
    topProducts,
  ] = await Promise.all([
    loadHeader(scope, today.from, today.to),
    loadHeader(scope, today.previousFrom, today.previousTo),
    loadHeader(scope, range.from, range.to),
    loadHeader(scope, range.previousFrom, range.previousTo),
    loadPayments(scope, range.from, range.to),
    loadPayments(scope, range.previousFrom, range.previousTo),
    loadInventoryValue(scope),
    loadPayables(scope),
    loadLowStock(scope),
    loadSalesTrend(scope, range.from, range.to, grain, now),
    loadRecentSales(scope),
    loadRecentPurchases(scope),
    loadTopProducts(scope, range.from, range.to),
  ]);

  const todayAvg = averageBill(todayHeader.revenue, todayHeader.bills);
  const yesterdayAvg = averageBill(
    yesterdayHeader.revenue,
    yesterdayHeader.bills,
  );

  return {
    generatedAt: now.toISOString(),
    timezone: BUSINESS_TIMEZONE,
    range: {
      preset,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      label: range.label,
      previousLabel: range.previousLabel,
    },
    returnsNote: RETURNS_NOTE,
    valuationMethod: INVENTORY_VALUATION_METHOD,
    valuationLabel: INVENTORY_VALUATION_LABEL,
    valuationNote: VALUATION_NOTE,
    payablesNote: PAYABLES_NOTE,
    kpis: {
      todaySales: compareNumbers(todayHeader.netSales, yesterdayHeader.netSales),
      todayBills: compareNumbers(todayHeader.bills, yesterdayHeader.bills),
      averageBill: compareNumbers(todayAvg, yesterdayAvg),
      lowStockProducts: snapshotMetric(lowStock.count),
      inventoryValue: snapshotMetric(inventoryValue),
      supplierPayables: snapshotMetric(payables),
    },
    kpiLinks: {
      todaySales: "/dashboard/sales",
      todayBills: "/dashboard/sales",
      averageBill: "/dashboard/analytics",
      lowStockProducts: "/dashboard/inventory/alerts",
      inventoryValue: "/dashboard/inventory",
      supplierPayables: "/dashboard/suppliers",
    },
    salesTrend: {
      grain,
      points: salesTrend,
      netSales: compareNumbers(rangeHeader.netSales, previousRangeHeader.netSales),
      collected: compareNumbers(
        rangePayments.collected,
        previousRangePayments.collected,
      ),
    },
    recentSales,
    lowStockAlerts: lowStock.alerts,
    recentPurchases,
    topProducts,
  };
}

export type { AnalyticsScope };
