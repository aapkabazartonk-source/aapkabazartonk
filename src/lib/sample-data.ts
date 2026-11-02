/**
 * Sample / mock data for Phase 1 UI demonstration only.
 * Clearly separated from real MongoDB data — do not use as production source.
 */
import type {
  ActivityItem,
  CategorySales,
  DashboardStat,
  LowStockAlert,
  RevenuePoint,
  TopProductSale,
  Transaction,
} from "@/types";

export const SAMPLE_STATS: DashboardStat[] = [
  {
    id: "products",
    label: "Total Products",
    value: "1,248",
    change: "+4.2%",
    trend: "up",
    description: "vs last month",
  },
  {
    id: "inventory-value",
    label: "Total Inventory Value",
    value: "₹18.4L",
    change: "+2.8%",
    trend: "up",
    description: "stock at cost",
  },
  {
    id: "today-revenue",
    label: "Today's Revenue",
    value: "₹42,850",
    change: "+12.1%",
    trend: "up",
    description: "vs yesterday",
  },
  {
    id: "monthly-revenue",
    label: "Monthly Revenue",
    value: "₹9.6L",
    change: "+8.4%",
    trend: "up",
    description: "this month",
  },
  {
    id: "low-stock",
    label: "Low Stock Products",
    value: "23",
    change: "-3",
    trend: "down",
    description: "need reorder",
  },
  {
    id: "orders",
    label: "Total Orders",
    value: "3,412",
    change: "+6.7%",
    trend: "up",
    description: "all time",
  },
];

export const SAMPLE_REVENUE: RevenuePoint[] = [
  { month: "May", revenue: 820000, orders: 276, sales: 48, units: 32 },
  { month: "Jun", revenue: 780000, orders: 264, sales: 42, units: 36 },
  { month: "Jul", revenue: 910000, orders: 302, sales: 55, units: 40 },
  { month: "Aug", revenue: 880000, orders: 291, sales: 50, units: 38 },
  { month: "Sep", revenue: 960000, orders: 318, sales: 62, units: 44 },
  { month: "Oct", revenue: 1020000, orders: 341, sales: 58, units: 46 },
  { month: "Nov", revenue: 960000, orders: 325, sales: 52, units: 41 },
  { month: "Dec", revenue: 720000, orders: 248, sales: 38, units: 28 },
];

export const SAMPLE_CATEGORY_SALES: CategorySales[] = [
  { name: "Groceries", value: 34, fill: "#A3CA69" },
  { name: "Beverages", value: 22, fill: "#9299C9" },
  { name: "Personal Care", value: 18, fill: "#C5DF8F" },
  { name: "Household", value: 14, fill: "#B8BFD9" },
  { name: "Snacks", value: 12, fill: "#A3CA69" },
];

export const SAMPLE_TOP_PRODUCTS_CHART: TopProductSale[] = [
  { name: "Basmati Rice 5kg", sales: 420 },
  { name: "Mustard Oil 1L", sales: 365 },
  { name: "Wheat Flour 10kg", sales: 312 },
  { name: "Toor Dal 1kg", sales: 288 },
  { name: "Tea Leaves 500g", sales: 241 },
];

export const SAMPLE_TRANSACTIONS: Transaction[] = [
  {
    id: "txn-1",
    orderId: "ORD-2841",
    customer: "Rahul Sharma",
    amount: 2450,
    items: 6,
    status: "completed",
    paymentMethod: "UPI",
    createdAt: "2026-11-02T14:32:00",
  },
  {
    id: "txn-2",
    orderId: "ORD-2840",
    customer: "Priya Mehta",
    amount: 890,
    items: 3,
    status: "completed",
    paymentMethod: "Cash",
    createdAt: "2026-11-02T13:18:00",
  },
  {
    id: "txn-3",
    orderId: "ORD-2839",
    customer: "Walk-in Customer",
    amount: 1560,
    items: 4,
    status: "pending",
    paymentMethod: "Card",
    createdAt: "2026-11-02T12:05:00",
  },
  {
    id: "txn-4",
    orderId: "ORD-2838",
    customer: "Amit Verma",
    amount: 4320,
    items: 11,
    status: "completed",
    paymentMethod: "UPI",
    createdAt: "2026-11-02T11:42:00",
  },
  {
    id: "txn-5",
    orderId: "ORD-2837",
    customer: "Sneha Patel",
    amount: 675,
    items: 2,
    status: "refunded",
    paymentMethod: "UPI",
    createdAt: "2026-11-02T10:15:00",
  },
  {
    id: "txn-6",
    orderId: "ORD-2836",
    customer: "Walk-in Customer",
    amount: 3120,
    items: 8,
    status: "completed",
    paymentMethod: "Cash",
    createdAt: "2026-11-01T18:50:00",
  },
];

export const SAMPLE_LOW_STOCK: LowStockAlert[] = [
  {
    id: "ls-1",
    name: "Sunflower Oil 1L",
    sku: "OIL-SF-1L",
    stock: 4,
    reorderLevel: 20,
  },
  {
    id: "ls-2",
    name: "Detergent Powder 1kg",
    sku: "HH-DET-1K",
    stock: 7,
    reorderLevel: 25,
  },
  {
    id: "ls-3",
    name: "Toothpaste 100g",
    sku: "PC-TP-100",
    stock: 9,
    reorderLevel: 30,
  },
  {
    id: "ls-4",
    name: "Sugar 1kg",
    sku: "GR-SUG-1K",
    stock: 12,
    reorderLevel: 40,
  },
  {
    id: "ls-5",
    name: "Biscuits Assorted",
    sku: "SN-BIS-AS",
    stock: 5,
    reorderLevel: 18,
  },
];

export const SAMPLE_TOP_SELLING = [
  {
    id: "tp-1",
    name: "Basmati Rice 5kg",
    category: "Groceries",
    unitsSold: 420,
    revenue: 252000,
  },
  {
    id: "tp-2",
    name: "Mustard Oil 1L",
    category: "Groceries",
    unitsSold: 365,
    revenue: 73000,
  },
  {
    id: "tp-3",
    name: "Wheat Flour 10kg",
    category: "Groceries",
    unitsSold: 312,
    revenue: 93600,
  },
  {
    id: "tp-4",
    name: "Toor Dal 1kg",
    category: "Groceries",
    unitsSold: 288,
    revenue: 51840,
  },
  {
    id: "tp-5",
    name: "Tea Leaves 500g",
    category: "Beverages",
    unitsSold: 241,
    revenue: 48200,
  },
];

export const SAMPLE_ACTIVITY: ActivityItem[] = [
  {
    id: "act-1",
    type: "sale",
    title: "New sale completed",
    description: "ORD-2841 · Rahul Sharma · ₹2,450",
    timestamp: "12 min ago",
  },
  {
    id: "act-2",
    type: "stock",
    title: "Low stock alert",
    description: "Sunflower Oil 1L dropped below reorder level",
    timestamp: "28 min ago",
  },
  {
    id: "act-3",
    type: "product",
    title: "Product updated",
    description: "Mustard Oil 1L price adjusted to ₹200",
    timestamp: "1 hr ago",
  },
  {
    id: "act-4",
    type: "customer",
    title: "New customer added",
    description: "Sneha Patel registered via POS",
    timestamp: "2 hr ago",
  },
  {
    id: "act-5",
    type: "supplier",
    title: "Purchase order received",
    description: "PO-119 from Rajasthan Agro Supplies",
    timestamp: "3 hr ago",
  },
  {
    id: "act-6",
    type: "system",
    title: "Daily backup completed",
    description: "Inventory snapshot saved successfully",
    timestamp: "5 hr ago",
  },
];
