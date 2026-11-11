export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export type OrderStatus =
  | "completed"
  | "pending"
  | "cancelled"
  | "refunded";

export type ActivityType =
  | "sale"
  | "stock"
  | "product"
  | "customer"
  | "supplier"
  | "system";

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  reorderLevel: number;
  status: StockStatus;
  unitsSold: number;
}

export interface Category {
  id: string;
  name: string;
  productCount: number;
  description: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalSpent: number;
  orders: number;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  email: string;
  productsSupplied: number;
}

export interface Transaction {
  id: string;
  orderId: string;
  customer: string;
  amount: number;
  items: number;
  status: OrderStatus;
  paymentMethod: string;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
}

export interface DashboardStat {
  id: string;
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  description: string;
  href?: string;
}

export interface RevenuePoint {
  month: string;
  revenue: number;
  orders: number;
  /** Chart series: sales (purple) */
  sales: number;
  /** Chart series: units (green) */
  units: number;
}

export interface CategorySales {
  name: string;
  value: number;
  fill: string;
}

export interface TopProductSale {
  name: string;
  sales: number;
}

export interface LowStockAlert {
  id: string;
  name: string;
  sku: string;
  stock: number;
  reorderLevel: number;
}
