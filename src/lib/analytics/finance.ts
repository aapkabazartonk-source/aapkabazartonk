import { allocateDiscountPaise } from "@/lib/gst";
import { fromPaise, multiplyMoney, roundMoney, sumMoney, toPaise } from "@/lib/money";

/** Sales that count toward revenue, bills, and profit. */
export const RECOGNIZED_SALE_STATUS = "COMPLETED";

/** Payment rows that are money received. Credit is the unpaid remainder. */
export const COLLECTED_PAYMENT_STATUSES = ["CONFIRMED", "MANUALLY_CONFIRMED"] as const;

/** Purchases that brought stock in. Drafts and cancellations do not. */
export const RECEIVED_PURCHASE_STATUS = "RECEIVED";

export const INVENTORY_VALUATION_METHOD = "catalog_purchase_price";
export const INVENTORY_VALUATION_LABEL =
  "Catalog purchase price × on-hand quantity";

export const EXPENSES_STATUS = "not_configured" as const;

export type CostStatus = "estimated" | "partial" | "unavailable";

export type ComparedNumber = {
  current: number | null;
  previous: number | null;
  delta: number | null;
  percent: number | null;
  comparable: boolean;
};

export function compareNumbers(
  current: number | null,
  previous: number | null,
): ComparedNumber {
  if (current === null || previous === null) {
    return {
      current,
      previous,
      delta: null,
      percent: null,
      comparable: false,
    };
  }
  const delta = roundMoney(current - previous);
  const percent =
    previous === 0
      ? null
      : roundMoney(((current - previous) / Math.abs(previous)) * 100);
  return { current, previous, delta, percent, comparable: true };
}

export function roundQty(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export type SaleFact = {
  saleStatus: string;
  grandTotal: number;
  taxableAmount: number;
  totalTax: number;
  items: Array<{ quantity: number }>;
};

export type PaymentFact = {
  status: string;
  amount: number;
};

export function isCollectedPayment(status: string) {
  return (COLLECTED_PAYMENT_STATUSES as readonly string[]).includes(status);
}

export function summarizeSales(sales: SaleFact[], payments: PaymentFact[]) {
  const included = sales.filter(
    (sale) => sale.saleStatus === RECOGNIZED_SALE_STATUS,
  );
  const revenue = sumMoney(included.map((sale) => sale.grandTotal));
  const bills = included.length;
  const units = roundQty(
    included.reduce(
      (sum, sale) =>
        sum + sale.items.reduce((line, item) => line + item.quantity, 0),
      0,
    ),
  );
  return {
    revenue,
    netSales: sumMoney(included.map((sale) => sale.taxableAmount)),
    gst: sumMoney(included.map((sale) => sale.totalTax)),
    bills,
    units,
    averageBill: bills === 0 ? null : roundMoney(revenue / bills),
    collected: sumMoney(
      payments
        .filter((payment) => isCollectedPayment(payment.status))
        .map((payment) => payment.amount),
    ),
  };
}

export type PurchaseValueFact = {
  status: string;
  total: number;
};

export function receivedPurchaseTotal(purchases: PurchaseValueFact[]) {
  return sumMoney(
    purchases
      .filter((purchase) => purchase.status === RECEIVED_PURCHASE_STATUS)
      .map((purchase) => purchase.total),
  );
}

export type PurchaseCostInput = {
  discount: number;
  items: Array<{
    productId: string;
    quantity: number;
    purchasePrice: number;
    lineDiscount: number;
  }>;
};

export type ProductCostBasis = {
  productId: string;
  receivedQuantity: number;
  costPaise: number;
};

/**
 * Ex-GST cost of received lines. The invoice-level discount is spread across
 * lines in paise and is not written back onto the purchase document.
 */
export function purchaseCostByProduct(
  purchases: PurchaseCostInput[],
): ProductCostBasis[] {
  const totals = new Map<string, { quantity: number; costPaise: number }>();

  for (const purchase of purchases) {
    const lines = purchase.items.map((item) => {
      const gross = toPaise(multiplyMoney(item.quantity, item.purchasePrice));
      const lineDiscount = Math.min(gross, toPaise(roundMoney(item.lineDiscount)));
      return {
        productId: item.productId,
        quantity: item.quantity,
        exTaxPaise: Math.max(0, gross - lineDiscount),
      };
    });
    const exTax = lines.reduce((sum, line) => sum + line.exTaxPaise, 0);
    const invoiceDiscount = Math.min(exTax, toPaise(roundMoney(purchase.discount)));
    const shares = allocateDiscountPaise(
      lines.map((line) => line.exTaxPaise),
      invoiceDiscount,
    );
    lines.forEach((line, index) => {
      const net = Math.max(0, line.exTaxPaise - (shares[index] ?? 0));
      const current = totals.get(line.productId) ?? {
        quantity: 0,
        costPaise: 0,
      };
      current.quantity = roundQty(current.quantity + line.quantity);
      current.costPaise += net;
      totals.set(line.productId, current);
    });
  }

  return [...totals.entries()].map(([productId, value]) => ({
    productId,
    receivedQuantity: value.quantity,
    costPaise: value.costPaise,
  }));
}

export type ProfitLine = {
  productId: string;
  quantity: number;
  netSales: number;
  revenue: number;
};

export type ProductProfit = {
  productId: string;
  quantity: number;
  revenue: number;
  netSales: number;
  coveredQuantity: number;
  coveredNetSales: number;
  uncoveredNetSales: number;
  cogs: number | null;
  grossProfit: number | null;
  costStatus: CostStatus;
};

export type ProfitSummary = {
  status: CostStatus;
  netSales: number;
  revenue: number;
  coveredNetSales: number;
  uncoveredNetSales: number;
  coveredUnits: number;
  uncoveredUnits: number;
  unitsSold: number;
  cogs: number | null;
  grossProfit: number | null;
  grossMargin: number | null;
  products: ProductProfit[];
};

function sharePaise(total: number, numerator: number, denominator: number) {
  if (denominator <= 0 || numerator <= 0) return 0;
  const ratio = Math.min(1, numerator / denominator);
  return Math.round(toPaise(total) * ratio);
}

export function profitFromLines(
  lines: ProfitLine[],
  costs: ProductCostBasis[],
): ProfitSummary {
  const grouped = new Map<string, ProfitLine>();
  for (const line of lines) {
    if (!line.productId || line.quantity <= 0) continue;
    const current = grouped.get(line.productId) ?? {
      productId: line.productId,
      quantity: 0,
      netSales: 0,
      revenue: 0,
    };
    current.quantity = roundQty(current.quantity + line.quantity);
    current.netSales = roundMoney(current.netSales + line.netSales);
    current.revenue = roundMoney(current.revenue + line.revenue);
    grouped.set(line.productId, current);
  }

  const costByProduct = new Map(costs.map((cost) => [cost.productId, cost]));
  const products: ProductProfit[] = [];

  for (const line of grouped.values()) {
    const cost = costByProduct.get(line.productId);
    const received = cost && cost.receivedQuantity > 0 ? cost.receivedQuantity : 0;
    const coveredQuantity =
      received > 0 ? roundQty(Math.min(line.quantity, received)) : 0;
    const uncoveredQuantity = roundQty(Math.max(0, line.quantity - coveredQuantity));
    let costStatus: CostStatus = "unavailable";
    if (coveredQuantity > 0 && uncoveredQuantity <= 0) costStatus = "estimated";
    else if (coveredQuantity > 0) costStatus = "partial";

    const coveredNetPaise = sharePaise(
      line.netSales,
      coveredQuantity,
      line.quantity,
    );
    const uncoveredNetPaise = toPaise(line.netSales) - coveredNetPaise;
    const cogsPaise =
      costStatus === "unavailable" || !cost || received <= 0
        ? null
        : Math.round((cost.costPaise / received) * coveredQuantity);
    const grossPaise =
      cogsPaise === null ? null : coveredNetPaise - cogsPaise;

    products.push({
      productId: line.productId,
      quantity: line.quantity,
      revenue: line.revenue,
      netSales: line.netSales,
      coveredQuantity,
      coveredNetSales: fromPaise(coveredNetPaise),
      uncoveredNetSales: fromPaise(Math.max(0, uncoveredNetPaise)),
      cogs: cogsPaise === null ? null : fromPaise(cogsPaise),
      grossProfit: grossPaise === null ? null : fromPaise(grossPaise),
      costStatus,
    });
  }

  const unitsSold = roundQty(
    products.reduce((sum, product) => sum + product.quantity, 0),
  );
  const coveredUnits = roundQty(
    products.reduce((sum, product) => sum + product.coveredQuantity, 0),
  );
  const uncoveredUnits = roundQty(Math.max(0, unitsSold - coveredUnits));
  const netSales = sumMoney(products.map((product) => product.netSales));
  const revenue = sumMoney(products.map((product) => product.revenue));
  const coveredNetSales = sumMoney(
    products.map((product) => product.coveredNetSales),
  );
  const uncoveredNetSales = sumMoney(
    products.map((product) => product.uncoveredNetSales),
  );

  let status: CostStatus = "estimated";
  if (unitsSold > 0 && coveredUnits <= 0) status = "unavailable";
  else if (uncoveredUnits > 0) status = "partial";

  const cogs =
    status === "unavailable"
      ? null
      : sumMoney(
          products
            .map((product) => product.cogs)
            .filter((value): value is number => value !== null),
        );
  const grossProfit =
    status === "unavailable" || cogs === null
      ? null
      : roundMoney(coveredNetSales - cogs);
  const grossMargin =
    grossProfit === null || coveredNetSales === 0
      ? null
      : roundMoney((grossProfit / coveredNetSales) * 100);

  return {
    status,
    netSales,
    revenue,
    coveredNetSales,
    uncoveredNetSales,
    coveredUnits,
    uncoveredUnits,
    unitsSold,
    cogs,
    grossProfit,
    grossMargin,
    products,
  };
}

export function costNote(status: CostStatus, unitsSold: number) {
  if (unitsSold <= 0) return "No completed sales in this range.";
  if (status === "unavailable") {
    return "Cost not recorded. No received purchase price covers the units sold in this range.";
  }
  if (status === "partial") {
    return "Partial estimate. Units without a received purchase cost are excluded from gross profit. Their cost is not treated as zero.";
  }
  return "Estimated from received purchase prices through the end of this range. This is not a cost recorded at the moment of sale. Opening stock and manual adjustments have no cost layer.";
}

export function catalogInventoryValue(
  products: Array<{
    isActive: boolean;
    currentStock: number;
    purchasePrice: number;
  }>,
) {
  const raw = products
    .filter((product) => product.isActive)
    .reduce(
      (sum, product) => sum + product.currentStock * product.purchasePrice,
      0,
    );
  return roundMoney(raw);
}

/** Net of supplier balances. Positive means the business owes suppliers. */
export function netSupplierBalance(balances: number[]) {
  return roundMoney(balances.reduce((sum, value) => sum + value, 0));
}

export function marginOrNull(grossProfit: number | null, coveredNetSales: number) {
  if (grossProfit === null || coveredNetSales === 0) return null;
  return roundMoney((grossProfit / coveredNetSales) * 100);
}

export const RETURNS_NOTE =
  "Returns and refunds are not recorded, so they are not deducted.";

export const EXPENSES_NOTE = "Expenses not configured";

export const PAYABLES_NOTE =
  "Current supplier balance for the business, including opening balances and advances. Not limited to the selected dates. Positive means payable.";

export const VALUATION_NOTE =
  "Current snapshot. The date range does not change this value. This is the catalog purchase price, not a weighted average and not a historical stock value.";

export const AGING_NOTE =
  "Days since the latest inward movement (purchase receive, opening stock, or stock in). This is not a FIFO cost layer.";

export const TURNOVER_NOTE =
  "Approximate. Units sold in the selected range divided by current on-hand units. Average inventory is not stored.";

export const PURCHASE_COMPARISON_NOTE =
  "Purchase value and sales revenue are both GST-inclusive. Purchases are not treated as expenses.";
