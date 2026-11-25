"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store } from "lucide-react";
import { DASHBOARD_NAV } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
      >
        <SheetHeader className="border-b border-sidebar-border px-4 py-5">
          <SheetTitle className="flex items-center gap-3 text-foreground">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Store className="h-5 w-5" />
            </div>
            <span>Aapka Bazar</span>
          </SheetTitle>
        </SheetHeader>
        <nav className="space-y-1 overflow-y-auto px-3 py-4">
          {DASHBOARD_NAV.map((item) => {
            const Icon = item.icon;
            if (item.children?.length) {
              return (
                <div key={item.href} className="space-y-1 pt-2">
                  <p className="px-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {item.title}
                  </p>
                  {item.children.map((child) => {
                    const ChildIcon = child.icon;
                    const active =
                      pathname === child.href ||
                      (child.href !== item.href &&
                        pathname.startsWith(`${child.href}/`));
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => onOpenChange(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground/80 hover:bg-sidebar-muted hover:text-foreground",
                        )}
                      >
                        <ChildIcon className="h-[18px] w-[18px]" />
                        {child.title}
                      </Link>
                    );
                  })}
                </div>
              );
            }

            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/80 hover:bg-sidebar-muted hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px]",
                    active
                      ? "text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
