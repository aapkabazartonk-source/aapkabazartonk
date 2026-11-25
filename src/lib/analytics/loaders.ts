import { Types } from "mongoose";
import {
  COLLECTED_PAYMENT_STATUSES,
  RECEIVED_PURCHASE_STATUS,
  RECOGNIZED_SALE_STATUS,
  catalogInventoryValue,
  isCollectedPayment,
  netSupplierBalance,
  profitFromLines,
  purchaseCostByProduct,
  roundQty,
} from "@/lib/analytics/finance";
import { roundMoney } from "@/lib/money";
import type { PaymentSlice } from "@/lib/analytics/types";
import { Payment } from "@/models/Payment";
import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";
import { Sale } from "@/models/Sale";
import { Supplier } from "@/models/Supplier";

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

const METHOD_ORDER = ["CASH", "UPI", "CARD", "BANK_TRANSFER"];
const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  CREDIT: "Credit",
};

function saleMatch(scope: AnalyticsScope, from: Date, to: Date) {
  return {
    businessId: scope.businessId,
    storeId: scope.storeId,
    saleStatus: RECOGNIZED_SALE_STATUS,
    createdAt: { $gte: from, $lt: to },
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

export async function loadCosts(scope: AnalyticsScope, until: Date) {
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

export async function loadProfit(scope: AnalyticsScope, from: Date, to: Date) {
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

export async function loadInventoryValue(scope: AnalyticsScope) {
  const products = await Product.find({
    businessId: scope.businessId,
    isActive: true,
  })
    .select("currentStock purchasePrice isActive")
    .lean<
      Array<{ currentStock: number; purchasePrice: number; isActive: boolean }>
    >();
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
