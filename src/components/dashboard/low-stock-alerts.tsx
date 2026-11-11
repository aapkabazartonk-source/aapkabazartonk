"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardLowStockItem } from "@/types/dashboard";

interface LowStockAlertsProps {
  data: DashboardLowStockItem[];
  loading?: boolean;
}

export function LowStockAlerts({ data, loading = false }: LowStockAlertsProps) {
  return (
    <Card className="animate-fade-in-up stagger-2">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-soft">
              <AlertTriangle className="h-4 w-4 text-purple" />
            </span>
            Low stock alerts
          </CardTitle>
          <CardDescription>Products at or below minimum stock</CardDescription>
        </div>
        <Link
          href="/dashboard/inventory/alerts"
          className="text-sm font-medium text-primary hover:underline"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {loading ? (
          <p className="py-6 text-sm text-muted-foreground">Loading alerts…</p>
        ) : data.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            All active products are above minimum stock.
          </p>
        ) : (
          data.map((item, index) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border border-border px-3.5 py-3 transition-colors hover:bg-muted/40",
                index % 2 === 0 ? "bg-success-soft/40" : "bg-purple-soft/70",
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
              </div>
              <div className="text-right">
                <Badge variant={item.currentStock <= 0 ? "destructive" : "warning"}>
                  {item.currentStock} left
                </Badge>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Min {item.minStockLevel}
                </p>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
