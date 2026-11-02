"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Store } from "lucide-react";
import { DASHBOARD_NAV } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}

export function Sidebar({ collapsed, onToggle, className }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out",
        collapsed ? "w-[76px]" : "w-64",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-[72px] items-center px-4",
          collapsed ? "justify-center" : "gap-3",
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-sm)]">
          <Store className="h-5 w-5 text-foreground" />
        </div>
        {!collapsed && (
          <div className="min-w-0 animate-fade-in">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">
              Aapka Bazar
            </p>
            <p className="truncate text-xs text-muted-foreground">Inventory OS</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {DASHBOARD_NAV.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.title : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-sm)]"
                  : "text-foreground/80 hover:bg-sidebar-muted hover:text-foreground",
                collapsed && "justify-center px-2.5",
              )}
            >
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  active
                    ? "text-primary-foreground"
                    : "text-muted-foreground group-hover:text-foreground",
                )}
              />
              {!collapsed && <span className="truncate">{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn(
            "w-full rounded-full text-muted-foreground hover:bg-sidebar-muted hover:text-foreground",
            collapsed ? "justify-center px-0" : "justify-between",
          )}
        >
          {!collapsed && <span className="text-xs font-medium">Collapse</span>}
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}
