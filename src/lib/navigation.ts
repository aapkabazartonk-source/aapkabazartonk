import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  Tags,
  Warehouse,
  Receipt,
  ShoppingCart,
  Users,
  Truck,
  BarChart3,
  FileText,
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
    title: "POS Billing",
    href: "/dashboard/billing",
    icon: Receipt,
    description: "Point of sale and billing",
  },
  {
    title: "Sales & Orders",
    href: "/dashboard/sales",
    icon: ShoppingCart,
    description: "View and manage sales orders",
  },
  {
    title: "Customers",
    href: "/dashboard/customers",
    icon: Users,
    description: "Customer profiles and history",
  },
  {
    title: "Suppliers",
    href: "/dashboard/suppliers",
    icon: Truck,
    description: "Supplier directory and purchases",
  },
  {
    title: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
    description: "Insights into business trends",
  },
  {
    title: "Reports",
    href: "/dashboard/reports",
    icon: FileText,
    description: "Exportable business reports",
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
