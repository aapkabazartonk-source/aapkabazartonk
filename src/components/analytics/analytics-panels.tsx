"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";

type Compared = {
  current: number | null;
  previous: number | null;
  delta: number | null;
  percent: number | null;
  comparable: boolean;
};

type ProductRow = {
  productId: string;
  name: string;
  sku: string;
  category: string;
  image: string | null;
  quantity: number;
  revenue: number;
  grossProfit: number | null;
  costStatus: string;
  currentStock: number | null;
};

export type AnalyticsPayloads = {
  overview: {
    generatedAt: string;
    range: { label: string };
    previousRange: { label: string };
    returnsNote: string;
    valuationLabel: string;
    kpis: {
      revenue: Compared;
      netSales: Compared;
      collected: Compared;
      grossProfit: Compared;
      grossMargin: Compared;
      costNote: string;
      bills: Compared;
      averageBill: Compared;
      unitsSold: Compared;
      purchases: Compared;
      inventoryValue: Compared;
      payables: Compared;
    };
    comparison: Array<{ key: string; label: string; metric: Compared }>;
  };
  revenue: {
    grain: string;
    points: Array<{ key: string; label: string; current: number | null; previous: number | null }>;
    totals: Compared;
  };
  sales: {
    bills: Compared;
    averageBill: Compared;
    unitsSold: Compared;
    revenue: Compared;
    growth: number | null;
  };
  categories: {
    categories: Array<{ name: string; revenue: number; units: number; share: number | null; fill: string }>;
    note: string;
  };
  payments: {
    collected: Compared;
    creditOutstanding: number;
    methods: Array<{ method: string; label: string; amount: number; percent: number | null }>;
    note: string;
  };
  profit: {
    revenue: number;
    netSales: number;
    gst: number;
    coveredNetSales: number;
    uncoveredNetSales: number;
    cogs: number | null;
    grossProfit: Compared;
    grossMargin: Compared;
    costStatus: string;
    costNote: string;
    expensesNote: string;
    netProfit: null;
    returnsNote: string;
  };
  inventory: {
    valuation: { amount: number; label: string; note: string };
    stockUnits: number;
    inStockProducts: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    valuationByCategory: Array<{ name: string; value: number; fill: string }>;
    movement: Array<{ label: string; stockIn: number; stockOut: number }>;
    fastMoving: ProductRow[];
    slowMoving: ProductRow[];
    slowDays: number;
    turnover: { ratio: number | null; note: string };
    aging: Array<{ key: string; label: string; products: number; units: number; value: number }>;
    agingNote: string;
  };
  purchases: {
    total: Compared;
    quantity: Compared;
    receipts: number;
    suppliers: Array<{ name: string; total: number; quantity: number }>;
    payablesNote: string;
    comparison: Array<{ label: string; purchases: number; sales: number }>;
    comparisonNote: string;
    supplierPayments: Array<{ label: string; amount: number }>;
    supplierPaymentsTotal: number;
  };
};

const tooltipStyle = {
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  boxShadow: "var(--shadow-md)",
};

function Empty({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-xl bg-muted/50 px-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function moneyOrDash(value: number | null) {
  return value === null ? "—" : formatCurrency(value);
}

function signed(metric: Compared, money = false) {
  if (!metric.comparable || metric.delta === null) return "—";
  const body = money ? formatCurrency(Math.abs(metric.delta)) : formatNumber(Math.abs(metric.delta));
  const sign = metric.delta > 0 ? "+" : metric.delta < 0 ? "−" : "";
  const percent = metric.percent === null ? "" : ` (${metric.percent > 0 ? "+" : ""}${metric.percent}%)`;
  return `${sign}${body}${percent}`;
}

export function RevenuePanel({ data }: { data: AnalyticsPayloads["revenue"] }) {
  const hasValue = data.points.some((point) => (point.current ?? 0) > 0 || (point.previous ?? 0) > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue trend</CardTitle>
        <CardDescription>
          Billed revenue, GST included. {data.grain} buckets against the previous period.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasValue ? (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.points}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#858C80", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#858C80", fontSize: 12 }} axisLine={false} tickLine={false} width={64} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value ?? 0))} />
                <Area type="monotone" dataKey="current" name="This period" stroke="#A3CA69" fill="#A3CA69" fillOpacity={0.25} connectNulls />
                <Area type="monotone" dataKey="previous" name="Previous period" stroke="#9299C9" fill="#9299C9" fillOpacity={0.15} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty message="No completed sales in this range." />
        )}
      </CardContent>
    </Card>
  );
}

export function SalesPanel({ data }: { data: AnalyticsPayloads["sales"] }) {
  const rows = [
    ["Total bills", formatNumber(data.bills.current ?? 0), signed(data.bills)],
    ["Average bill", moneyOrDash(data.averageBill.current), signed(data.averageBill, true)],
    ["Units sold", formatNumber(data.unitsSold.current ?? 0), signed(data.unitsSold)],
    ["Total sales", formatCurrency(data.revenue.current ?? 0), signed(data.revenue, true)],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales performance</CardTitle>
        <CardDescription>
          Growth {data.growth === null ? "—" : `${data.growth > 0 ? "+" : ""}${data.growth}%`} versus the previous period.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map(([label, value, change]) => (
          <div key={label} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="font-mono text-lg font-semibold">{value}</p>
            </div>
            <p className="text-right text-xs text-muted-foreground">{change}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function CategoryPanel({ data }: { data: AnalyticsPayloads["categories"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Category performance</CardTitle>
        <CardDescription>{data.note}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.categories.length === 0 ? (
          <Empty message="No completed sales in this range." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.categories} dataKey="revenue" nameKey="name" innerRadius={52} outerRadius={80} strokeWidth={0}>
                    {data.categories.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value ?? 0))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.categories} layout="vertical" margin={{ left: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fill: "#858C80", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  <Bar dataKey="revenue" radius={6}>
                    {data.categories.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {data.categories.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm">
            {data.categories.map((category) => (
              <li key={category.name} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{category.name}</span>
                <span className="font-mono">
                  {formatCurrency(category.revenue)} · {formatNumber(category.units)} · {category.share ?? 0}%
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function PaymentPanel({ data }: { data: AnalyticsPayloads["payments"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment analytics</CardTitle>
        <CardDescription>{data.note}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Collected</p>
            <p className="font-mono text-2xl font-semibold">{formatCurrency(data.collected.current ?? 0)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Credit outstanding</p>
            <p className="font-mono text-lg">{formatCurrency(data.creditOutstanding)}</p>
          </div>
        </div>
        {data.methods.length === 0 ? (
          <Empty message="No collected payments in this range." />
        ) : (
          <ul className="space-y-3">
            {data.methods.map((method) => (
              <li key={method.method}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{method.label}</span>
                  <span className="font-mono">
                    {formatCurrency(method.amount)} · {method.percent ?? 0}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, method.percent ?? 0)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function ProfitPanel({ data }: { data: AnalyticsPayloads["profit"] }) {
  const rows = [
    ["Net sales", formatCurrency(data.netSales), "Excludes GST and includes discounts"],
    ["GST", formatCurrency(data.gst), "Excluded from profit"],
    ["COGS", data.cogs === null ? "Unavailable" : formatCurrency(data.cogs), data.costNote],
    ["Covered net sales", formatCurrency(data.coveredNetSales), "Units with a received purchase cost"],
    ["Excluded net sales", formatCurrency(data.uncoveredNetSales), "Units with no purchase cost. Cost is not treated as zero."],
    [
      "Gross profit",
      moneyOrDash(data.grossProfit.current),
      data.costStatus === "unavailable"
        ? "Cost not recorded"
        : data.costStatus === "partial"
          ? "Partial estimate. Uncovered units are excluded."
          : "Estimated from received purchase prices",
    ],
    ["Gross margin", data.grossMargin.current === null ? "Unavailable" : `${data.grossMargin.current}%`, "Blank when covered net sales are zero"],
    ["Operating expenses", data.expensesNote, "Purchases stay in inventory until sold"],
    ["Net profit", "Unavailable", "Not calculated without expense records"],
  ];
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Profit and loss</CardTitle>
          <CardDescription>{data.returnsNote}</CardDescription>
        </div>
        <Badge variant={data.costStatus === "unavailable" ? "warning" : "secondary"}>
          {data.costStatus === "unavailable" ? "Cost not recorded" : "Estimated cost"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(([label, value, note]) => (
            <div key={label} className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 font-mono text-xl font-semibold">{value}</p>
              <p className="mt-2 text-xs text-muted-foreground">{note}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const VIEWS = [
  ["top_qty", "Best selling"],
  ["top_revenue", "Top revenue"],
  ["top_profit", "Most profitable"],
  ["slow", "Slow moving"],
  ["no_sales", "No sales"],
] as const;

export type ProductsPayload = {
  rows: ProductRow[];
  pagination: { page: number; totalPages: number; total: number };
  note: string;
  view: string;
};

export function ProductPanel({
  data,
  view,
  slowDays,
  onView,
  onSlowDays,
  onPage,
}: {
  data: ProductsPayload | null;
  view: string;
  slowDays: "30" | "60" | "90";
  onView: (view: string) => void;
  onSlowDays: (days: "30" | "60" | "90") => void;
  onPage: (page: number) => void;
}) {
  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Product performance</CardTitle>
            <CardDescription>{data?.note ?? "Loading products…"}</CardDescription>
          </div>
          {(view === "slow") ? (
            <Select value={slowDays} onValueChange={(value) => onSlowDays(value as "30" | "60" | "90")}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {VIEWS.map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={view === value ? "default" : "outline"}
              onClick={() => onView(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {!data || data.rows.length === 0 ? (
          <Empty message={data ? "Nothing to show for this view." : "Loading products…"} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Gross profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.productId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {row.image ? (
                        // Product images are stored URLs and may not be a configured image host.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Package className="h-4 w-4" />
                        </span>
                      )}
                      <span className="font-medium">{row.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                  <TableCell>{row.category}</TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(row.quantity)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(row.revenue)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {row.grossProfit === null ? "—" : formatCurrency(row.grossProfit)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {data && data.pagination.totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {data.pagination.page} of {data.pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={data.pagination.page <= 1} onClick={() => onPage(data.pagination.page - 1)}>
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={data.pagination.page >= data.pagination.totalPages}
                onClick={() => onPage(data.pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function InventoryPanel({ data }: { data: AnalyticsPayloads["inventory"] }) {
  const counts = [
    ["On-hand units", formatNumber(data.stockUnits)],
    ["In stock", formatNumber(data.inStockProducts)],
    ["Low stock", formatNumber(data.lowStockProducts)],
    ["Out of stock", formatNumber(data.outOfStockProducts)],
  ];
  const movementHasData = data.movement.some((point) => point.stockIn > 0 || point.stockOut > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory analytics</CardTitle>
        <CardDescription>
          {data.valuation.label}. {data.valuation.note}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl bg-secondary p-4">
            <p className="text-sm text-muted-foreground">Valuation</p>
            <p className="font-mono text-xl font-semibold">{formatCurrency(data.valuation.amount)}</p>
          </div>
          {counts.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="font-mono text-xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-medium">Value by category</p>
            {data.valuationByCategory.length === 0 ? (
              <Empty message="No stock value to chart." />
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.valuationByCategory}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#858C80", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#858C80", fontSize: 12 }} axisLine={false} tickLine={false} width={64} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value ?? 0))} />
                    <Bar dataKey="value" radius={6}>
                      {data.valuationByCategory.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div>
            <p className="mb-3 text-sm font-medium">Stock movement</p>
            {movementHasData ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.movement}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#858C80", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="stockIn" name="In" fill="#A3CA69" radius={4} />
                    <Bar dataKey="stockOut" name="Out" fill="#9299C9" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty message="No stock movements in this range." />
            )}
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium">Fast moving</p>
            <ProductList rows={data.fastMoving} empty="No completed sales in this range." />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Slow moving · {data.slowDays} days</p>
            <p className="mb-2 text-xs text-muted-foreground">In stock with no sales in this window. Not the same as low stock.</p>
            <ProductList rows={data.slowMoving} empty="No slow-moving products in this window." />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border p-4">
            <p className="text-sm text-muted-foreground">Inventory turnover</p>
            <p className="font-mono text-2xl font-semibold">
              {data.turnover.ratio === null ? "Unavailable" : data.turnover.ratio}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{data.turnover.note}</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Inventory aging</p>
            <p className="mb-2 text-xs text-muted-foreground">{data.agingNote}</p>
            <ul className="space-y-2 text-sm">
              {data.aging.map((bucket) => (
                <li key={bucket.key} className="flex justify-between gap-3">
                  <span>{bucket.label}</span>
                  <span className="font-mono">
                    {bucket.products} products · {formatCurrency(bucket.value)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductList({ rows, empty }: { rows: ProductRow[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((row) => (
        <li key={row.productId} className="flex items-center justify-between gap-3">
          <span>
            {row.name}
            <span className="ml-2 font-mono text-xs text-muted-foreground">{row.sku}</span>
          </span>
          <span className="font-mono">{formatNumber(row.quantity)}</span>
        </li>
      ))}
    </ul>
  );
}

export function PurchasePanel({ data }: { data: AnalyticsPayloads["purchases"] }) {
  const hasComparison = data.comparison.some((point) => point.purchases > 0 || point.sales > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchases and suppliers</CardTitle>
        <CardDescription>{data.comparisonNote}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-secondary p-4">
            <p className="text-sm text-muted-foreground">Received purchase value</p>
            <p className="font-mono text-xl font-semibold">{formatCurrency(data.total.current ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-sm text-muted-foreground">Quantity received</p>
            <p className="font-mono text-xl font-semibold">{formatNumber(data.quantity.current ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-sm text-muted-foreground">Supplier payments</p>
            <p className="font-mono text-xl font-semibold">{formatCurrency(data.supplierPaymentsTotal)}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{data.payablesNote}</p>
        {hasComparison ? (
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.comparison}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#858C80", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#858C80", fontSize: 12 }} axisLine={false} tickLine={false} width={64} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value ?? 0))} />
                <Bar dataKey="sales" name="Sales revenue" fill="#9299C9" radius={4} />
                <Bar dataKey="purchases" name="Purchase value" fill="#A3CA69" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty message="No received purchases or completed sales in this range." />
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium">Top suppliers</p>
            {data.suppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No received purchases in this range.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.suppliers.map((supplier) => (
                  <li key={supplier.name} className="flex justify-between gap-3">
                    <span>{supplier.name}</span>
                    <span className="font-mono">{formatCurrency(supplier.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Supplier payment trend</p>
            {data.supplierPayments.some((point) => point.amount > 0) ? (
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.supplierPayments}>
                    <XAxis dataKey="label" tick={{ fill: "#858C80", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value ?? 0))} />
                    <Area type="monotone" dataKey="amount" name="Paid" stroke="#A3CA69" fill="#A3CA69" fillOpacity={0.25} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No supplier payments in this range.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ComparisonTable({
  rows,
}: {
  rows: AnalyticsPayloads["overview"]["comparison"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Period comparison</CardTitle>
        <CardDescription>
          Absolute and percentage change against the previous period. A dash means the previous value was zero or the figure is unavailable.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">Previous</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead className="text-right">Change %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell>{row.label}</TableCell>
                <TableCell className="text-right font-mono">
                  {row.metric.current === null ? "—" : formatNumber(row.metric.current)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {row.metric.previous === null ? "—" : formatNumber(row.metric.previous)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {row.metric.delta === null ? "—" : formatNumber(row.metric.delta)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {row.metric.percent === null ? "—" : `${row.metric.percent}%`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
