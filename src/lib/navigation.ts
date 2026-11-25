import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  Tags,
  Warehouse,
  ClipboardList,
  Receipt,
  ShoppingCart,
  Users,
  Truck,
  BarChart3,
  Wallet,
  Settings,
  Landmark,
  HandCoins,
  BookOpen,
  FileSpreadsheet,
  UserRound,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  children?: NavItem[];
}

export const DASHBOARD_NAV: NavItem[] = [
  {
    title: "Dashboard",
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
    title: "Customers",
    href: "/dashboard/customers",
    icon: Users,
    description: "Customer directory and purchase history",
  },
  {
    title: "Suppliers",
    href: "/dashboard/suppliers",
    icon: Truck,
    description: "Suppliers, payables, and ledgers",
  },
  {
    title: "Accounts & Expenses",
    href: "/dashboard/accounts",
    icon: Wallet,
    description: "Cashbook, expenses, salaries, and profit",
    children: [
      {
        title: "Financial Overview",
        href: "/dashboard/accounts",
        icon: Landmark,
        description: "Revenue, profit, and balances",
      },
      {
        title: "Expenses",
        href: "/dashboard/accounts/expenses",
        icon: HandCoins,
        description: "Operating expenses and payments",
      },
      {
        title: "Staff & Salaries",
        href: "/dashboard/accounts/staff",
        icon: UserRound,
        description: "Staff directory and salary payments",
      },
      {
        title: "Accounts & Cashbook",
        href: "/dashboard/accounts/cashbook",
        icon: BookOpen,
        description: "Cash, bank, and fund movements",
      },
      {
        title: "Profit & Loss",
        href: "/dashboard/accounts/profit-loss",
        icon: FileSpreadsheet,
        description: "P&L statement for the period",
      },
    ],
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

  for (const item of DASHBOARD_NAV) {
    if (item.children?.length) {
      const child = [...item.children]
        .sort((a, b) => b.href.length - a.href.length)
        .find((entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`));
      if (child) return child;
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return item;
      }
      continue;
    }
    if (item.href !== "/dashboard" && pathname.startsWith(item.href)) {
      return item;
    }
  }
  return undefined;
}
