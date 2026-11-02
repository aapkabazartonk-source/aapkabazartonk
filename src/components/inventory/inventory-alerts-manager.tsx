"use client";

import { useEffect, useState, useEffectEvent } from "react";
import Link from "next/link";
import { AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { StockAdjustmentSheet } from "@/components/inventory/stock-adjustment-sheet";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SimpleStatCard } from "@/components/shared/simple-stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiClientError, fetchJson } from "@/lib/fetch-json";
import { formatNumber } from "@/lib/utils";
import type { StockAdjustmentCreateValues } from "@/lib/validators/inventory";
import type { CategoryRecord } from "@/types/catalog";
import type { InventoryAlertsResponse } from "@/types/inventory";

export function InventoryAlertsManager() {
  const [rows, setRows] = useState<InventoryAlertsResponse["data"]>([]);
  const [stats, setStats] = useState<InventoryAlertsResponse["stats"] | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchJson<{ data: CategoryRecord[] }>("/api/categories?flat=true")
      .then((res) => setCategories(res.data))
      .catch(() => setCategories([]));
  }, []);

  const load = useEffectEvent(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "12",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status !== "all") params.set("status", status);
      if (category !== "all") params.set("category", category);

      const res = await fetchJson<InventoryAlertsResponse>(
        `/api/inventory/alerts?${params.toString()}`,
      );
      setRows(res.data);
      setStats(res.stats);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Failed to load stock alerts",
      );
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void load();
  }, [page, debouncedSearch, status, category]);

  async function handleAdjust(values: StockAdjustmentCreateValues) {
    setSubmitting(true);
    try {
      await fetchJson("/api/inventory/adjustments", {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Stock adjusted");
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock alerts"
        description="Live low-stock and out-of-stock products based on minimum levels."
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/inventory">Back to inventory</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SimpleStatCard
          label="Total alerts"
          value={formatNumber(stats?.totalAlerts ?? 0)}
          icon={AlertTriangle}
          index={0}
        />
        <SimpleStatCard
          label="Low stock"
          value={formatNumber(stats?.lowStockProducts ?? 0)}
          index={1}
        />
        <SimpleStatCard
          label="Out of stock"
          value={formatNumber(stats?.outOfStockProducts ?? 0)}
          index={2}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                placeholder="Search product or SKU..."
                className="h-10 rounded-xl pl-9"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setPage(1);
                setStatus(value);
              }}
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Low + out of stock</SelectItem>
                <SelectItem value="low_stock">Low stock only</SelectItem>
                <SelectItem value="out_of_stock">Out of stock only</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={category}
              onValueChange={(value) => {
                setPage(1);
                setCategory(value);
              }}
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories
                  .filter((item) => !item.parentCategory)
                  .map((item) => (
                    <SelectItem key={item._id} value={item._id}>
                      {item.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Loading alerts...
            </p>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="No alerts"
              description="All products are above their minimum stock levels."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Min</TableHead>
                    <TableHead className="text-right">Suggested reorder</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const categoryRef =
                      row.category && typeof row.category === "object"
                        ? (row.category as { name?: string })
                        : null;
                    const images = Array.isArray(row.images)
                      ? (row.images as string[])
                      : [];
                    const stockStatus = String(row.stockStatus);

                    return (
                      <TableRow key={String(row._id)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-secondary text-xs font-semibold">
                              {images[0] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={images[0]}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                String(row.name).slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <span className="font-medium">{String(row.name)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {String(row.sku)}
                        </TableCell>
                        <TableCell>{categoryRef?.name ?? "—"}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatNumber(Number(row.currentStock))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(Number(row.minStockLevel))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(Number(row.suggestedReorder))}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              stockStatus === "out_of_stock"
                                ? "destructive"
                                : "warning"
                            }
                          >
                            {stockStatus === "out_of_stock"
                              ? "Out of stock"
                              : "Low stock"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedProductId(String(row._id));
                              setAdjustOpen(true);
                            }}
                          >
                            Adjust
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <PaginationControls
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <StockAdjustmentSheet
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        submitting={submitting}
        defaultProductId={selectedProductId}
        onSubmit={handleAdjust}
      />
    </div>
  );
}
