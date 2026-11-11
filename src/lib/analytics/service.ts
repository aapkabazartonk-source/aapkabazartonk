import { Types } from "mongoose";
import {
  STOCK_IN_MOVEMENT_TYPES,
  STOCK_OUT_MOVEMENT_TYPES,
} from "@/lib/constants";
import {
  AGING_NOTE,
  COLLECTED_PAYMENT_STATUSES,
  EXPENSES_NOTE,
  EXPENSES_STATUS,
  INVENTORY_VALUATION_LABEL,
  INVENTORY_VALUATION_METHOD,
  PAYABLES_NOTE,
  PURCHASE_COMPARISON_NOTE,
  RECEIVED_PURCHASE_STATUS,
  RECOGNIZED_SALE_STATUS,
  RETURNS_NOTE,
  TURNOVER_NOTE,
  VALUATION_NOTE,
  catalogInventoryValue,
  compareNumbers,
  costNote,
  isCollectedPayment,
  netSupplierBalance,
  profitFromLines,
  purchaseCostByProduct,
  roundQty,
  type ComparedNumber,
  type ProductProfit,
} from "@/lib/analytics/finance";
import type { AnalyticsQuery } from "@/lib/analytics/query";
import {
  BUSINESS_TIMEZONE,
  bucketLabel,
  enumerateBuckets,
  istDayDiff,
  slowWindow,
  type AnalyticsGrain,
} from "@/lib/analytics/time";
import { roundMoney } from "@/lib/money";
import { Business } from "@/models/Business";
import { InventoryLog } from "@/models/InventoryLog";
import { Payment } from "@/models/Payment";
import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";
import { Sale } from "@/models/Sale";
import { Supplier } from "@/models/Supplier";
import { SupplierPayment } from "@/models/SupplierPayment";
import type {
  AnalyticsMeta,
  AnalyticsProductRow,
  CategoryPoint,
  Pagination,
  PaymentSlice,
  PurchaseSalesPoint,
  RevenuePoint,
  TrendPoint,
} from "@/lib/analytics/types";

export const ANALYTICS_EXPORT_ROW_CAP = 5000;

const CHART_COLORS = ["#A3CA69", "#9299C9", "#7EAB3A", "#B8BFD9", "#C5DF8F", "#5F8F86"];

const METHOD_ORDER = ["CASH", "UPI", "CARD", "BANK_TRANSFER"];
const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  CREDIT: "Credit",
};

const INWARD_MOVEMENTS = ["PURCHASE_RECEIVE", "OPENING_STOCK", "STOCK_IN"] as const;

export type AnalyticsScope = {
  businessId: Types.ObjectId;
  storeId: Types.ObjectId;
};

type HeaderTotals = {
  revenue: number;
  netSales: number;
  gst: number;
  bills: number;
  units: number;
};

type LineGroup = {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  netSales: number;
  revenue: number;
};

type ProductDoc = {
  _id: Types.ObjectId;
  name: string;
  sku: string;
  images?: string[];
  category?: { name?: string } | Types.ObjectId | null;
  currentStock?: number;
  purchasePrice?: number;
  isActive?: boolean;
  createdAt?: Date;
};

function saleMatch(scope: AnalyticsScope, from: Date, to: Date) {
  return {
    businessId: scope.businessId,
    storeId: scope.storeId,
    saleStatus: RECOGNIZED_SALE_STATUS,
    createdAt: { $gte: from, $lt: to },
  };
}

function receivedMatch(scope: AnalyticsScope, from: Date, to: Date) {
  return {
    businessId: scope.businessId,
    storeId: scope.storeId,
    status: RECEIVED_PURCHASE_STATUS,
    receivedAt: { $gte: from, $lt: to },
  };
}

function dateFormat(grain: AnalyticsGrain) {
  if (grain === "hour") return "%Y-%m-%dT%H";
  if (grain === "day") return "%Y-%m-%d";
  if (grain === "week") return "%G-W%V";
  return "%Y-%m";
}

function meta(query: AnalyticsQuery): AnalyticsMeta {
  return {
    generatedAt: new Date().toISOString(),
    timezone: BUSINESS_TIMEZONE,
    range: {
      preset: query.range.preset,
      from: query.range.from.toISOString(),
      to: query.range.to.toISOString(),
      label: query.range.label,
    },
    previousRange: {
      from: query.range.previousFrom.toISOString(),
      to: query.range.previousTo.toISOString(),
      label: query.range.previousLabel,
    },
  };
}

function snapshotMetric(current: number): ComparedNumber {
  return {
    current,
    previous: null,
    delta: null,
    percent: null,
    comparable: false,
  };
}

function quantityReduce() {
  return {
    $reduce: {
      input: "$items",
      initialValue: 0,
      in: { $add: ["$$value", "$$this.quantity"] },
    },
  };
}

export async function loadHeader(
  scope: AnalyticsScope,
  from: Date,
  to: Date,
): Promise<HeaderTotals> {
  const [row] = await Sale.aggregate<{
    revenue: number;
    netSales: number;
    gst: number;
    bills: number;
    units: number;
  }>([
    { $match: saleMatch(scope, from, to) },
    {
      $group: {
        _id: null,
        revenue: { $sum: "$grandTotal" },
        netSales: { $sum: "$taxableAmount" },
        gst: { $sum: "$totalTax" },
        bills: { $sum: 1 },
        units: { $sum: quantityReduce() },
      },
    },
  ]);
  return {
    revenue: roundMoney(row?.revenue ?? 0),
    netSales: roundMoney(row?.netSales ?? 0),
    gst: roundMoney(row?.gst ?? 0),
    bills: row?.bills ?? 0,
    units: roundQty(row?.units ?? 0),
  };
}

export async function loadLines(
  scope: AnalyticsScope,
  from: Date,
  to: Date,
): Promise<LineGroup[]> {
  const rows = await Sale.aggregate<{
    _id: Types.ObjectId;
    name: string;
    sku: string;
    quantity: number;
    netSales: number;
    revenue: number;
  }>([
    { $match: saleMatch(scope, from, to) },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        name: { $first: "$items.productName" },
        sku: { $first: "$items.sku" },
        quantity: { $sum: "$items.quantity" },
        netSales: { $sum: "$items.taxableAmount" },
        revenue: { $sum: "$items.finalAmount" },
      },
    },
  ]);
  return rows.map((row) => ({
    productId: String(row._id),
    name: row.name,
    sku: row.sku,
    quantity: roundQty(row.quantity),
    netSales: roundMoney(row.netSales),
    revenue: roundMoney(row.revenue),
  }));
}

async function loadCosts(scope: AnalyticsScope, until: Date) {
  const purchases = await Purchase.find({
    businessId: scope.businessId,
    storeId: scope.storeId,
    status: RECEIVED_PURCHASE_STATUS,
    receivedAt: { $ne: null, $lt: until },
  })
    .select("discount items")
    .lean<
      Array<{
        discount?: number;
        items: Array<{
          product: Types.ObjectId;
          quantity: number;
          purchasePrice: number;
          discount?: number;
        }>;
      }>
    >();

  return purchaseCostByProduct(
    purchases.map((purchase) => ({
      discount: purchase.discount ?? 0,
      items: purchase.items.map((item) => ({
        productId: String(item.product),
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        lineDiscount: item.discount ?? 0,
      })),
    })),
  );
}

async function loadProfit(scope: AnalyticsScope, from: Date, to: Date) {
  const [lines, costs] = await Promise.all([
    loadLines(scope, from, to),
    loadCosts(scope, to),
  ]);
  return { lines, profit: profitFromLines(lines, costs) };
}

export async function loadPayments(scope: AnalyticsScope, from: Date, to: Date) {
  const rows = await Payment.aggregate<{
    _id: { method: string; status: string };
    amount: number;
  }>([
    {
      $match: {
        businessId: scope.businessId,
        storeId: scope.storeId,
        createdAt: { $gte: from, $lt: to },
        status: { $in: [...COLLECTED_PAYMENT_STATUSES, "CREDIT"] },
      },
    },
    {
      $group: {
        _id: { method: "$paymentMethod", status: "$status" },
        amount: { $sum: "$amount" },
      },
    },
  ]);

  const byMethod = new Map<string, number>();
  let collected = 0;
  let credit = 0;
  for (const row of rows) {
    if (row._id.status === "CREDIT" || row._id.method === "CREDIT") {
      credit += row.amount;
      continue;
    }
    if (!isCollectedPayment(row._id.status)) continue;
    collected += row.amount;
    byMethod.set(row._id.method, (byMethod.get(row._id.method) ?? 0) + row.amount);
  }
  const collectedRounded = roundMoney(collected);
  const methods: PaymentSlice[] = [...byMethod.entries()]
    .map(([method, amount]) => ({
      method,
      label: METHOD_LABEL[method] ?? "Other",
      amount: roundMoney(amount),
      percent:
        collectedRounded === 0
          ? null
          : roundMoney((amount / collectedRounded) * 100),
    }))
    .sort((a, b) => {
      const ai = METHOD_ORDER.indexOf(a.method);
      const bi = METHOD_ORDER.indexOf(b.method);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  return {
    collected: collectedRounded,
    creditOutstanding: roundMoney(credit),
    methods,
  };
}

async function loadPurchaseTotal(scope: AnalyticsScope, from: Date, to: Date) {
  const [row] = await Purchase.aggregate<{
    total: number;
    quantity: number;
    count: number;
  }>([
    { $match: receivedMatch(scope, from, to) },
    {
      $group: {
        _id: null,
        total: { $sum: "$total" },
        quantity: { $sum: quantityReduce() },
        count: { $sum: 1 },
      },
    },
  ]);
  return {
    total: roundMoney(row?.total ?? 0),
    quantity: roundQty(row?.quantity ?? 0),
    count: row?.count ?? 0,
  };
}

export async function loadInventoryValue(scope: AnalyticsScope) {
  const products = await Product.find({
    businessId: scope.businessId,
    isActive: true,
  })
    .select("currentStock purchasePrice isActive")
    .lean<Array<{ currentStock: number; purchasePrice: number; isActive: boolean }>>();
  return catalogInventoryValue(products);
}

export async function loadPayables(scope: AnalyticsScope) {
  const rows = await Supplier.find({ businessId: scope.businessId })
    .select("currentBalance")
    .lean<Array<{ currentBalance?: number }>>();
  return netSupplierBalance(rows.map((row) => row.currentBalance ?? 0));
}

export function averageBill(revenue: number, bills: number) {
  return bills === 0 ? null : roundMoney(revenue / bills);
}

function profitMetric(current: number | null, previous: number | null) {
  return compareNumbers(current, previous);
}

async function productMap(scope: AnalyticsScope, ids: string[]) {
  if (ids.length === 0) return new Map<string, ProductDoc>();
  const docs = await Product.find({
    businessId: scope.businessId,
    _id: { $in: ids },
  })
    .select("name sku images category currentStock purchasePrice isActive createdAt")
    .populate("category", "name")
    .lean<ProductDoc[]>();
  return new Map(docs.map((doc) => [String(doc._id), doc]));
}

function categoryOf(product: ProductDoc | undefined) {
  const category = product?.category;
  if (
    category &&
    typeof category === "object" &&
    "name" in category &&
    typeof category.name === "string" &&
    category.name.trim()
  ) {
    return category.name;
  }
  return "Uncategorised";
}

function toProductRow(
  line: { productId: string; name: string; sku: string },
  profit: ProductProfit | undefined,
  product: ProductDoc | undefined,
  quantity: number,
  revenue: number,
): AnalyticsProductRow {
  return {
    productId: line.productId,
    name: product?.name || line.name,
    sku: product?.sku || line.sku,
    category: categoryOf(product),
    image: product?.images?.[0] || null,
    quantity,
    revenue,
    grossProfit: profit?.grossProfit ?? null,
    costStatus: profit?.costStatus ?? "unavailable",
    currentStock:
      product && typeof product.currentStock === "number"
        ? product.currentStock
        : null,
  };
}

function paginate<T>(rows: T[], page: number, limit: number): {
  rows: T[];
  pagination: Pagination;
} {
  const total = rows.length;
  const start = (page - 1) * limit;
  return {
    rows: rows.slice(start, start + limit),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getOverview(scope: AnalyticsScope, query: AnalyticsQuery) {
  const { from, to, previousFrom, previousTo } = query.range;
  const [
    currentHeader,
    previousHeader,
    currentProfit,
    previousProfit,
    currentPayments,
    previousPayments,
    currentPurchases,
    previousPurchases,
    inventoryValue,
    payables,
  ] = await Promise.all([
    loadHeader(scope, from, to),
    loadHeader(scope, previousFrom, previousTo),
    loadProfit(scope, from, to),
    loadProfit(scope, previousFrom, previousTo),
    loadPayments(scope, from, to),
    loadPayments(scope, previousFrom, previousTo),
    loadPurchaseTotal(scope, from, to),
    loadPurchaseTotal(scope, previousFrom, previousTo),
    loadInventoryValue(scope),
    loadPayables(scope),
  ]);

  const grossProfit = profitMetric(
    currentProfit.profit.grossProfit,
    previousProfit.profit.grossProfit,
  );
  const grossMargin = profitMetric(
    currentProfit.profit.grossMargin,
    previousProfit.profit.grossMargin,
  );
  const revenue = compareNumbers(currentHeader.revenue, previousHeader.revenue);
  const netSales = compareNumbers(currentHeader.netSales, previousHeader.netSales);
  const bills = compareNumbers(currentHeader.bills, previousHeader.bills);
  const unitsSold = compareNumbers(currentHeader.units, previousHeader.units);
  const purchases = compareNumbers(
    currentPurchases.total,
    previousPurchases.total,
  );

  return {
    ...meta(query),
    returnsNote: RETURNS_NOTE,
    kpis: {
      revenue,
      netSales,
      collected: compareNumbers(
        currentPayments.collected,
        previousPayments.collected,
      ),
      grossProfit,
      grossMargin,
      costStatus: currentProfit.profit.status,
      costNote: costNote(currentProfit.profit.status, currentProfit.profit.unitsSold),
      bills,
      averageBill: compareNumbers(
        averageBill(currentHeader.revenue, currentHeader.bills),
        averageBill(previousHeader.revenue, previousHeader.bills),
      ),
      unitsSold,
      purchases,
      inventoryValue: snapshotMetric(inventoryValue),
      payables: snapshotMetric(payables),
    },
    valuationMethod: INVENTORY_VALUATION_METHOD,
    valuationLabel: INVENTORY_VALUATION_LABEL,
    valuationNote: VALUATION_NOTE,
    payablesNote: PAYABLES_NOTE,
    comparison: [
      { key: "revenue", label: "Revenue", metric: revenue },
      { key: "grossProfit", label: "Gross profit", metric: grossProfit },
      { key: "bills", label: "Bills", metric: bills },
      { key: "unitsSold", label: "Units sold", metric: unitsSold },
      { key: "purchases", label: "Purchase value", metric: purchases },
    ],
  };
}

async function bucketSums(
  scope: AnalyticsScope,
  from: Date,
  to: Date,
  grain: AnalyticsGrain,
  source: "sales" | "purchases" | "supplierPayments",
) {
  const format = dateFormat(grain);
  const timezone = BUSINESS_TIMEZONE;
  if (source === "sales") {
    const rows = await Sale.aggregate<{ _id: string; amount: number }>([
      { $match: saleMatch(scope, from, to) },
      {
        $group: {
          _id: {
            $dateToString: { format, date: "$createdAt", timezone },
          },
          amount: { $sum: "$grandTotal" },
        },
      },
    ]);
    return new Map(rows.map((row) => [row._id, roundMoney(row.amount)]));
  }
  if (source === "purchases") {
    const rows = await Purchase.aggregate<{ _id: string; amount: number }>([
      { $match: receivedMatch(scope, from, to) },
      {
        $group: {
          _id: {
            $dateToString: { format, date: "$receivedAt", timezone },
          },
          amount: { $sum: "$total" },
        },
      },
    ]);
    return new Map(rows.map((row) => [row._id, roundMoney(row.amount)]));
  }
  const rows = await SupplierPayment.aggregate<{ _id: string; amount: number }>([
    {
      $match: {
        businessId: scope.businessId,
        paymentDate: { $gte: from, $lt: to },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format, date: "$paymentDate", timezone },
        },
        amount: { $sum: "$amount" },
      },
    },
  ]);
  return new Map(rows.map((row) => [row._id, roundMoney(row.amount)]));
}

export async function getRevenue(scope: AnalyticsScope, query: AnalyticsQuery) {
  const grain = query.grain;
  const [currentHeader, previousHeader, currentMap, previousMap] =
    await Promise.all([
      loadHeader(scope, query.range.from, query.range.to),
      loadHeader(scope, query.range.previousFrom, query.range.previousTo),
      bucketSums(scope, query.range.from, query.range.to, grain, "sales"),
      bucketSums(
        scope,
        query.range.previousFrom,
        query.range.previousTo,
        grain,
        "sales",
      ),
    ]);
  const currentKeys = enumerateBuckets(
    query.range.from,
    query.range.to,
    grain,
    query.now,
  );
  const previousKeys = enumerateBuckets(
    query.range.previousFrom,
    query.range.previousTo,
    grain,
    query.now,
  );
  const length = Math.max(currentKeys.length, previousKeys.length);
  const points: RevenuePoint[] = Array.from({ length }, (_, index) => {
    const currentKey = currentKeys[index];
    const previousKey = previousKeys[index];
    const key = currentKey ?? previousKey ?? String(index);
    return {
      key,
      label: bucketLabel(key, grain),
      current: currentKey ? (currentMap.get(currentKey) ?? 0) : null,
      previous: previousKey ? (previousMap.get(previousKey) ?? 0) : null,
    };
  });

  return {
    ...meta(query),
    grain,
    points,
    totals: compareNumbers(currentHeader.revenue, previousHeader.revenue),
  };
}

export async function getSales(scope: AnalyticsScope, query: AnalyticsQuery) {
  const [current, previous] = await Promise.all([
    loadHeader(scope, query.range.from, query.range.to),
    loadHeader(scope, query.range.previousFrom, query.range.previousTo),
  ]);
  return {
    ...meta(query),
    bills: compareNumbers(current.bills, previous.bills),
    averageBill: compareNumbers(
      averageBill(current.revenue, current.bills),
      averageBill(previous.revenue, previous.bills),
    ),
    unitsSold: compareNumbers(current.units, previous.units),
    revenue: compareNumbers(current.revenue, previous.revenue),
    growth: compareNumbers(current.revenue, previous.revenue).percent,
  };
}

export async function getCategories(scope: AnalyticsScope, query: AnalyticsQuery) {
  const lines = await loadLines(scope, query.range.from, query.range.to);
  const products = await productMap(
    scope,
    lines.map((line) => line.productId),
  );
  const groups = new Map<string, { revenue: number; units: number }>();
  for (const line of lines) {
    const name = categoryOf(products.get(line.productId));
    const current = groups.get(name) ?? { revenue: 0, units: 0 };
    current.revenue = roundMoney(current.revenue + line.revenue);
    current.units = roundQty(current.units + line.quantity);
    groups.set(name, current);
  }
  const total = roundMoney(
    [...groups.values()].reduce((sum, group) => sum + group.revenue, 0),
  );
  const categories: CategoryPoint[] = [...groups.entries()]
    .map(([name, group]) => ({
      name,
      revenue: group.revenue,
      units: group.units,
      share: total === 0 ? null : roundMoney((group.revenue / total) * 100),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    ...meta(query),
    categories: categories.map((category, index) => ({
      ...category,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    })),
    note: "Category follows the product's category now. Sale lines do not store a category snapshot.",
  };
}

export async function getPayments(scope: AnalyticsScope, query: AnalyticsQuery) {
  const [current, previous] = await Promise.all([
    loadPayments(scope, query.range.from, query.range.to),
    loadPayments(scope, query.range.previousFrom, query.range.previousTo),
  ]);
  return {
    ...meta(query),
    collected: compareNumbers(current.collected, previous.collected),
    creditOutstanding: current.creditOutstanding,
    methods: current.methods,
    note: "Collected amounts come from confirmed payment records. Credit is the unpaid remainder and is not included in the collected total. Sale revenue can be higher when a bill is partly unpaid.",
  };
}

export async function getProfitLoss(scope: AnalyticsScope, query: AnalyticsQuery) {
  const [header, current, previous] = await Promise.all([
    loadHeader(scope, query.range.from, query.range.to),
    loadProfit(scope, query.range.from, query.range.to),
    loadProfit(scope, query.range.previousFrom, query.range.previousTo),
  ]);
  const profit = current.profit;
  return {
    ...meta(query),
    revenue: header.revenue,
    netSales: header.netSales,
    gst: header.gst,
    coveredNetSales: profit.coveredNetSales,
    uncoveredNetSales: profit.uncoveredNetSales,
    coveredUnits: profit.coveredUnits,
    uncoveredUnits: profit.uncoveredUnits,
    unitsSold: header.units,
    cogs: profit.cogs,
    grossProfit: compareNumbers(profit.grossProfit, previous.profit.grossProfit),
    grossMargin: compareNumbers(profit.grossMargin, previous.profit.grossMargin),
    costStatus: profit.status,
    costBasis: "estimated_purchase_wac" as const,
    costNote: costNote(profit.status, profit.unitsSold),
    operatingExpenses: null,
    expensesStatus: EXPENSES_STATUS,
    expensesNote: EXPENSES_NOTE,
    netProfit: null,
    returnsNote: RETURNS_NOTE,
  };
}

export async function getProductPerformance(
  scope: AnalyticsScope,
  query: AnalyticsQuery,
) {
  if (query.view === "slow" || query.view === "no_sales") {
    return listQuietProducts(scope, query);
  }

  const { lines, profit } = await loadProfit(
    scope,
    query.range.from,
    query.range.to,
  );
  const lineById = new Map(lines.map((line) => [line.productId, line]));
  let ranked = profit.products.flatMap((product) => {
    const line = lineById.get(product.productId);
    if (!line) return [];
    if (query.view === "top_profit" && product.grossProfit === null) return [];
    return [{ line, product }];
  });
  ranked = ranked.sort((a, b) => {
    if (query.view === "top_qty") {
      return b.product.quantity - a.product.quantity || b.line.revenue - a.line.revenue;
    }
    if (query.view === "top_profit") {
      return (b.product.grossProfit ?? 0) - (a.product.grossProfit ?? 0);
    }
    return b.line.revenue - a.line.revenue || b.product.quantity - a.product.quantity;
  });
  const page = paginate(ranked, query.page, query.limit);
  const products = await productMap(
    scope,
    page.rows.map((row) => row.line.productId),
  );
  return {
    ...meta(query),
    view: query.view,
    slowDays: query.slowDays,
    rows: page.rows.map((row) =>
      toProductRow(
        row.line,
        row.product,
        products.get(row.line.productId),
        row.product.quantity,
        row.line.revenue,
      ),
    ),
    pagination: page.pagination,
    note:
      query.view === "top_profit"
        ? "Gross profit is shown only where a received purchase cost covers at least part of the quantity sold."
        : costNote(profit.status, profit.unitsSold),
  };
}

async function listQuietProducts(scope: AnalyticsScope, query: AnalyticsQuery) {
  const window =
    query.view === "slow"
      ? slowWindow(query.now, query.slowDays)
      : { from: query.range.from, to: query.range.to };
  const lines = await loadLines(scope, window.from, window.to);
  const soldIds = lines
    .filter((line) => line.quantity > 0)
    .map((line) => line.productId);
  const filter: Record<string, unknown> = {
    businessId: scope.businessId,
    isActive: true,
    ...(soldIds.length > 0 ? { _id: { $nin: soldIds } } : {}),
  };
  if (query.view === "slow") {
    filter.currentStock = { $gt: 0 };
  }
  const total = await Product.countDocuments(filter);
  const docs = await Product.find(filter)
    .sort({ name: 1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit)
    .select("name sku images category currentStock")
    .populate("category", "name")
    .lean<ProductDoc[]>();

  const rows: AnalyticsProductRow[] = docs.map((doc) =>
    toProductRow(
      { productId: String(doc._id), name: doc.name, sku: doc.sku },
      undefined,
      doc,
      0,
      0,
    ),
  );

  return {
    ...meta(query),
    view: query.view,
    slowDays: query.slowDays,
    rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
    note:
      query.view === "slow"
        ? `In-stock products with no completed sales in the last ${query.slowDays} days. This is not the low-stock alert.`
        : "Active products with no completed sales in the selected range.",
  };
}

export async function getInventory(scope: AnalyticsScope, query: AnalyticsQuery) {
  const active = { businessId: scope.businessId, isActive: true };
  const [stockUnitsRow, value, inStock, lowStock, outOfStock, byCategory, movementRows, lines, quiet, inward, stocked] =
    await Promise.all([
      Product.aggregate<{ total: number }>([
        { $match: active },
        { $group: { _id: null, total: { $sum: "$currentStock" } } },
      ]),
      loadInventoryValue(scope),
      Product.countDocuments({
        ...active,
        $expr: { $gt: ["$currentStock", "$minStockLevel"] },
      }),
      Product.countDocuments({
        ...active,
        $expr: {
          $and: [
            { $gt: ["$currentStock", 0] },
            { $lte: ["$currentStock", "$minStockLevel"] },
          ],
        },
      }),
      Product.countDocuments({ ...active, currentStock: { $lte: 0 } }),
      Product.aggregate<{ name: string; value: number }>([
        { $match: active },
        {
          $group: {
            _id: "$category",
            value: { $sum: { $multiply: ["$currentStock", "$purchasePrice"] } },
          },
        },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "category",
          },
        },
        {
          $project: {
            name: {
              $ifNull: [{ $arrayElemAt: ["$category.name", 0] }, "Uncategorised"],
            },
            value: 1,
          },
        },
        { $sort: { value: -1 } },
        { $limit: 8 },
      ]),
      InventoryLog.aggregate<{ _id: string; stockIn: number; stockOut: number }>([
        {
          $match: {
            businessId: scope.businessId,
            storeId: scope.storeId,
            createdAt: { $gte: query.range.from, $lt: query.range.to },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: BUSINESS_TIMEZONE,
              },
            },
            stockIn: {
              $sum: {
                $cond: [
                  { $in: ["$movementType", [...STOCK_IN_MOVEMENT_TYPES]] },
                  "$quantity",
                  {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$movementType", "CORRECTION"] },
                          { $gt: ["$newStock", "$previousStock"] },
                        ],
                      },
                      "$quantity",
                      0,
                    ],
                  },
                ],
              },
            },
            stockOut: {
              $sum: {
                $cond: [
                  { $in: ["$movementType", [...STOCK_OUT_MOVEMENT_TYPES]] },
                  "$quantity",
                  {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$movementType", "CORRECTION"] },
                          { $lt: ["$newStock", "$previousStock"] },
                        ],
                      },
                      "$quantity",
                      0,
                    ],
                  },
                ],
              },
            },
          },
        },
      ]),
      loadLines(scope, query.range.from, query.range.to),
      listQuietProducts(scope, { ...query, view: "slow", page: 1, limit: 5 }),
      InventoryLog.aggregate<{ _id: Types.ObjectId; lastIn: Date }>([
        {
          $match: {
            businessId: scope.businessId,
            storeId: scope.storeId,
            movementType: { $in: [...INWARD_MOVEMENTS] },
          },
        },
        { $group: { _id: "$product", lastIn: { $max: "$createdAt" } } },
      ]),
      Product.find({ ...active, currentStock: { $gt: 0 } })
        .select("currentStock purchasePrice createdAt")
        .lean<
          Array<{
            _id: Types.ObjectId;
            currentStock: number;
            purchasePrice: number;
            createdAt: Date;
          }>
        >(),
    ]);

  const movementMap = new Map(
    movementRows.map((row) => [row._id, { stockIn: row.stockIn, stockOut: row.stockOut }]),
  );
  const dayKeys = enumerateBuckets(query.range.from, query.range.to, "day", query.now);
  const movement = dayKeys.map((key) => ({
    key,
    label: bucketLabel(key, "day"),
    stockIn: roundQty(movementMap.get(key)?.stockIn ?? 0),
    stockOut: roundQty(movementMap.get(key)?.stockOut ?? 0),
  }));

  const fast = [...lines]
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 5);
  const products = await productMap(
    scope,
    fast.map((line) => line.productId),
  );
  const costs = await loadCosts(scope, query.range.to);
  const fastProfit = profitFromLines(fast, costs);
  const profitById = new Map(
    fastProfit.products.map((product) => [product.productId, product]),
  );

  const onHand = roundQty(stockUnitsRow[0]?.total ?? 0);
  const unitsSold = roundQty(lines.reduce((sum, line) => sum + line.quantity, 0));
  const turnover =
    onHand <= 0
      ? null
      : roundMoney(unitsSold / onHand);

  const lastIn = new Map(inward.map((row) => [String(row._id), row.lastIn]));
  const agingBuckets = [
    { key: "0_30", label: "0–30 days", min: 0, max: 30 },
    { key: "31_60", label: "31–60 days", min: 31, max: 60 },
    { key: "61_90", label: "61–90 days", min: 61, max: 90 },
    { key: "91_plus", label: "91+ days", min: 91, max: Number.POSITIVE_INFINITY },
  ].map((bucket) => ({ ...bucket, products: 0, units: 0, value: 0 }));

  for (const product of stocked) {
    const inwardAt = lastIn.get(String(product._id)) ?? product.createdAt;
    const age = istDayDiff(inwardAt, query.now);
    const bucket = agingBuckets.find((item) => age >= item.min && age <= item.max);
    if (!bucket) continue;
    bucket.products += 1;
    bucket.units = roundQty(bucket.units + product.currentStock);
    bucket.value = roundMoney(
      bucket.value + product.currentStock * product.purchasePrice,
    );
  }

  return {
    ...meta(query),
    valuation: {
      amount: value,
      method: INVENTORY_VALUATION_METHOD,
      label: INVENTORY_VALUATION_LABEL,
      note: VALUATION_NOTE,
    },
    stockUnits: onHand,
    inStockProducts: inStock,
    lowStockProducts: lowStock,
    outOfStockProducts: outOfStock,
    valuationByCategory: byCategory.map((row, index) => ({
      name: row.name,
      value: roundMoney(row.value),
      fill: CHART_COLORS[index % CHART_COLORS.length],
    })),
    movement,
    fastMoving: fast.map((line) =>
      toProductRow(
        line,
        profitById.get(line.productId),
        products.get(line.productId),
        line.quantity,
        line.revenue,
      ),
    ),
    slowMoving: quiet.rows,
    slowDays: query.slowDays,
    turnover: {
      ratio: turnover,
      note: TURNOVER_NOTE,
    },
    aging: agingBuckets.map(({ key, label, products: count, units, value: bucketValue }) => ({
      key,
      label,
      products: count,
      units,
      value: bucketValue,
    })),
    agingNote: AGING_NOTE,
  };
}

export async function getPurchases(scope: AnalyticsScope, query: AnalyticsQuery) {
  const grain = query.grain;
  const [current, previous, suppliers, salesMap, purchaseMap, paymentMap, payables] =
    await Promise.all([
      loadPurchaseTotal(scope, query.range.from, query.range.to),
      loadPurchaseTotal(scope, query.range.previousFrom, query.range.previousTo),
      Purchase.aggregate<{
        _id: { name?: string };
        total: number;
        quantity: number;
      }>([
        { $match: receivedMatch(scope, query.range.from, query.range.to) },
        {
          $group: {
            _id: { name: "$supplierName" },
            total: { $sum: "$total" },
            quantity: { $sum: quantityReduce() },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 10 },
      ]),
      bucketSums(scope, query.range.from, query.range.to, grain, "sales"),
      bucketSums(scope, query.range.from, query.range.to, grain, "purchases"),
      bucketSums(scope, query.range.from, query.range.to, grain, "supplierPayments"),
      loadPayables(scope),
    ]);

  const keys = enumerateBuckets(
    query.range.from,
    query.range.to,
    grain,
    query.now,
  );
  const comparison: PurchaseSalesPoint[] = keys.map((key) => ({
    key,
    label: bucketLabel(key, grain),
    purchases: purchaseMap.get(key) ?? 0,
    sales: salesMap.get(key) ?? 0,
  }));
  const supplierPayments: TrendPoint[] = keys.map((key) => ({
    key,
    label: bucketLabel(key, grain),
    amount: paymentMap.get(key) ?? 0,
  }));

  return {
    ...meta(query),
    grain,
    total: compareNumbers(current.total, previous.total),
    quantity: compareNumbers(current.quantity, previous.quantity),
    receipts: current.count,
    suppliers: suppliers.map((row) => ({
      name: row._id.name?.trim() || "Unnamed supplier",
      total: roundMoney(row.total),
      quantity: roundQty(row.quantity),
    })),
    payables: snapshotMetric(payables),
    payablesNote: PAYABLES_NOTE,
    comparison,
    comparisonNote: PURCHASE_COMPARISON_NOTE,
    supplierPayments,
    supplierPaymentsTotal: roundMoney(
      supplierPayments.reduce((sum, point) => sum + point.amount, 0),
    ),
  };
}

export async function getBusinessName(scope: AnalyticsScope) {
  const business = await Business.findById(scope.businessId).select("name").lean<{
    name?: string;
  } | null>();
  return business?.name?.trim() || "Business";
}

export async function getExportBundle(scope: AnalyticsScope, query: AnalyticsQuery) {
  const exportQuery: AnalyticsQuery = {
    ...query,
    page: 1,
    limit: ANALYTICS_EXPORT_ROW_CAP,
    view: "top_revenue",
  };
  const [businessName, overview, categories, payments, profit, products, purchases] =
    await Promise.all([
      getBusinessName(scope),
      getOverview(scope, query),
      getCategories(scope, query),
      getPayments(scope, query),
      getProfitLoss(scope, query),
      getProductPerformance(scope, exportQuery),
      getPurchases(scope, query),
    ]);
  return {
    businessName,
    overview,
    categories,
    payments,
    profit,
    products,
    purchases,
    rowCap: ANALYTICS_EXPORT_ROW_CAP,
  };
}

export type AnalyticsExportBundle = Awaited<ReturnType<typeof getExportBundle>>;
