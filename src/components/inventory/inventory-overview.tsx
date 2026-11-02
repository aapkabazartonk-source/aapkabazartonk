"use client";

import { useEffect, useState, useEffectEvent } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  IndianRupee,
  Package,
  PackageCheck,
  PackageX,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { InventoryCharts } from "@/components/inventory/inventory-charts";
import { StockAdjustmentSheet } from "@/components/inventory/stock-adjustment-sheet";
import { SimpleStatCard } from "@/components/shared/simple-stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ApiClientError, fetchJson } from "@/lib/fetch-json";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { StockAdjustmentCreateValues } from "@/lib/validators/inventory";
import type { InventoryOverviewResponse } from "@/types/inventory";

function productName(value: unknown) {
  if (value && typeof value === "object" && "name" in value) {
    return String((value as { name: string }).name);
  }
  return "—";
}

function productSku(value: unknown) {
  if (value && typeof value === "object" && "sku" in value) {
    return String((value as { sku: string }).sku);
  }
  return "";
}

export function InventoryOverview() {
  const [data, setData] = useState<InventoryOverviewResponse["data"] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useEffectEvent(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetchJson<InventoryOverviewResponse>(
        `/api/inventory?${params.toString()}`,
      );
      setData(res.data);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Failed to load inventory overview",
      );
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void load();
  }, [from, to]);

  async function handleAdjust(values: StockAdjustmentCreateValues) {
    setSubmitting(true);
    try {
      await fetchJson("/api/inventory/adjustments", {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Stock adjusted and logged");
      setAdjustOpen(false);
      await load();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Failed to adjust stock",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Monitor stock health, movements, valuation, and quick adjustments."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/inventory/history">History</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/inventory/alerts">Alerts</Link>
            </Button>
            <Button onClick={() => setAdjustOpen(true)}>
              <Plus className="h-4 w-4" />
              Adjust stock
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">From</p>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-10 w-[160px] rounded-xl"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">To</p>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-10 w-[160px] rounded-xl"
          />
        </div>
        {(from || to) && (
          <Button
            type="button"
            variant="ghost"
            className="rounded-full"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            Clear dates
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SimpleStatCard
          label="Total products"
          value={loading ? "—" : formatNumber(stats?.totalProducts ?? 0)}
          icon={Package}
          index={0}
        />
        <SimpleStatCard
          label="Total stock units"
          value={loading ? "—" : formatNumber(stats?.totalStockUnits ?? 0)}
          icon={Boxes}
          index={1}
        />
        <SimpleStatCard
          label="Inventory value"
          value={
            loading ? "—" : formatCurrency(stats?.totalInventoryValue ?? 0)
          }
          icon={IndianRupee}
          index={2}
        />
        <SimpleStatCard
          label="In stock"
          value={loading ? "—" : formatNumber(stats?.inStockProducts ?? 0)}
          icon={PackageCheck}
          index={3}
        />
        <SimpleStatCard
          label="Low stock"
          value={loading ? "—" : formatNumber(stats?.lowStockProducts ?? 0)}
          icon={AlertTriangle}
          index={4}
        />
        <SimpleStatCard
          label="Out of stock"
          value={loading ? "—" : formatNumber(stats?.outOfStockProducts ?? 0)}
          icon={PackageX}
          index={5}
        />
      </div>

      {data ? (
        <InventoryCharts
          stockMovementTrend={data.charts.stockMovementTrend}
          stockByCategory={data.charts.stockByCategory}
          valuationByCategory={data.charts.valuationByCategory}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Low stock alerts</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/inventory/alerts">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.lowStockAlerts ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No low stock items.</p>
            ) : (
              data?.lowStockAlerts.map((item) => (
                <div
                  key={String(item._id)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {String(item.name)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {String(item.sku)} · min {formatNumber(Number(item.minStockLevel))}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {formatNumber(Number(item.currentStock))} left
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Out of stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.outOfStockProducts ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No out-of-stock products.
              </p>
            ) : (
              data?.outOfStockProducts.map((item) => (
                <div
                  key={String(item._id)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {String(item.name)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Reorder ~{formatNumber(Number(item.suggestedReorder))}
                    </p>
                  </div>
                  <Badge variant="destructive">Out</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowRightLeft className="h-4 w-4" />
              Recent movements
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/inventory/history">History</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.recentMovements ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No inventory movements yet.
              </p>
            ) : (
              data?.recentMovements.map((item) => (
                <div
                  key={String(item._id)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {productName(item.product)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {String(item.movementType)} · {productSku(item.product)}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium">
                      {formatNumber(Number(item.previousStock))} →{" "}
                      {formatNumber(Number(item.newStock))}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recently updated products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.recentlyUpdated ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No products yet.</p>
            ) : (
              data?.recentlyUpdated.map((item) => (
                <div
                  key={String(item._id)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {String(item.name)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {String(item.sku)}
                    </p>
                  </div>
                  <p className="text-sm font-medium">
                    {formatNumber(Number(item.currentStock))}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <StockAdjustmentSheet
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        submitting={submitting}
        onSubmit={handleAdjust}
      />
    </div>
  );
}
