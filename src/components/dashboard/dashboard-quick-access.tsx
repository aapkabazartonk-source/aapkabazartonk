"use client";

import Link from "next/link";
import {
  Package,
  Receipt,
  ShoppingCart,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type QuickLink = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  emphasis?: "primary" | "default";
};

const QUICK_LINKS: QuickLink[] = [
  {
    href: "/dashboard/billing",
    label: "POS Billing",
    description: "New bill",
    icon: Receipt,
    emphasis: "primary",
  },
  {
    href: "/dashboard/sales",
    label: "Sales",
    description: "Invoices",
    icon: ShoppingCart,
  },
  {
    href: "/dashboard/products",
    label: "Products",
    description: "Catalog",
    icon: Package,
  },
  {
    href: "/dashboard/inventory",
    label: "Inventory",
    description: "Stock",
    icon: Warehouse,
  },
  {
    href: "/dashboard/accounts",
    label: "Accounts",
    description: "Cash & expenses",
    icon: Wallet,
  },
];

export function DashboardQuickAccess() {
  return (
    <section className="mb-8" aria-label="Quick access">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground sm:text-lg">
            Quick access
          </h2>
          <p className="text-sm text-muted-foreground">
            Jump to billing and everyday store tasks.
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {QUICK_LINKS.map((item) => {
          const Icon = item.icon;
          const primary = item.emphasis === "primary";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3.5 rounded-2xl border px-4 py-4 transition-all",
                primary
                  ? "border-primary/40 bg-primary text-primary-foreground shadow-[var(--shadow-sm)] hover:bg-primary/90"
                  : "border-border bg-card text-foreground hover:border-primary/35 hover:bg-secondary/60",
              )}
            >
              <span
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                  primary
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "bg-muted text-foreground group-hover:bg-secondary",
                )}
              >
                <Icon className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold leading-tight">
                  {item.label}
                </span>
                <span
                  className={cn(
                    "block text-sm",
                    primary
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground",
                  )}
                >
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
