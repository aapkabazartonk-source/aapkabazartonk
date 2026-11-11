import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  Tags,
  Warehouse,
  ClipboardList,
  Receipt,
  ShoppingCart,
  Truck,
  BarChart3,
  Settings,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export const DASHBOARD_NAV: NavItem[] = [
  {
    title: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Business performance at a glance",
  },
  {
    title: "Products",
    href: "/dashboard/products",
    icon: Package,
    description: "Manage your product catalog",
  },
  {
    title: "Categories",
    href: "/dashboard/categories",
    icon: Tags,
    description: "Organize products by category",
  },
  {
    title: "Inventory",
    href: "/dashboard/inventory",
    icon: Warehouse,
    description: "Track stock levels and movements",
  },
  {
    title: "Purchases",
    href: "/dashboard/purchases",
    icon: ClipboardList,
    description: "Purchase drafts and goods receiving",
  },
  {
    title: "POS Billing",
    href: "/dashboard/billing",
    icon: Receipt,
    description: "Point of sale and billing",
  },
  {
    title: "Sales",
    href: "/dashboard/sales",
    icon: ShoppingCart,
    description: "Sales history and invoices",
  },
  {
    title: "Suppliers",
    href: "/dashboard/suppliers",
    icon: Truck,
    description: "Suppliers, payables, and ledgers",
  },
  {
    title: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
    description: "Insights into business trends",
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    description: "Account and store preferences",
  },
];

export function getNavItem(pathname: string): NavItem | undefined {
  if (pathname === "/dashboard") {
    return DASHBOARD_NAV[0];
  }
  return DASHBOARD_NAV.find(
    (item) => item.href !== "/dashboard" && pathname.startsWith(item.href),
  );
}
