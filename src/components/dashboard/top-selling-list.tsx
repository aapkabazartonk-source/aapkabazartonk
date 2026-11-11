"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import type { DashboardTopProduct } from "@/types/dashboard";

interface TopSellingListProps {
  data: DashboardTopProduct[];
  rangeLabel?: string;
  loading?: boolean;
}

export function TopSellingList({
  data,
  rangeLabel,
  loading = false,
}: TopSellingListProps) {
  return (
    <Card className="animate-fade-in-up stagger-3">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Top-selling products</CardTitle>
          <CardDescription>
            {rangeLabel
              ? `Best sellers · ${rangeLabel}`
              : "Best performers by units sold"}
          </CardDescription>
        </div>
        <Link
          href="/dashboard/analytics"
          className="text-sm font-medium text-primary hover:underline"
        >
          Analytics
        </Link>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {loading ? (
          <p className="py-6 text-sm text-muted-foreground">Loading products…</p>
        ) : data.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            No completed sales in this period.
          </p>
        ) : (
          data.map((item, index) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-3 rounded-2xl border border-border bg-background px-3.5 py-3 transition-colors hover:bg-muted/40"
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  index % 2 === 0
                    ? "bg-success-soft text-foreground"
                    : "bg-purple-soft text-purple",
                )}
              >
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.category ? `${item.category} · ` : null}
                  <span className="font-mono">{item.sku}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{formatNumber(item.unitsSold)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(item.revenue)}
                </p>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
