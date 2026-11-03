"use client";

import { useEffect, useState, useEffectEvent } from "react";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
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
import { INVENTORY_MOVEMENT_TYPES } from "@/lib/constants";
import { ApiClientError, fetchJson } from "@/lib/fetch-json";
import { formatNumber } from "@/lib/utils";
import type { CategoryRecord } from "@/types/catalog";
import type { InventoryHistoryResponse } from "@/types/inventory";

function formatDateTime(value: unknown) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(String(value)));
}

export function InventoryHistoryManager() {
  const [rows, setRows] = useState<InventoryHistoryResponse["data"]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [movementType, setMovementType] = useState("all");
  const [category, setCategory] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

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
      if (movementType !== "all") params.set("movementType", movementType);
      if (category !== "all") params.set("category", category);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetchJson<InventoryHistoryResponse>(
        `/api/inventory/history?${params.toString()}`,
      );
      setRows(res.data);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Failed to load inventory history",
      );
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void load();
  }, [page, debouncedSearch, movementType, category, from, to]);

  async function exportCsv() {
    try {
      const params = new URLSearchParams({ format: "csv" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (movementType !== "all") params.set("movementType", movementType);
      if (category !== "all") params.set("category", category);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const response = await fetch(`/api/inventory/history?${params.toString()}`);
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "inventory-history.csv";
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch {
      toast.error("Failed to export CSV");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory history"
        description="Immutable stock movement ledger across adjustments and purchases."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/inventory">Back to inventory</Link>
            </Button>
            <Button variant="outline" onClick={() => void exportCsv()}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <div className="relative min-w-0 sm:col-span-2 xl:col-span-2">
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
              value={movementType}
              onValueChange={(value) => {
                setPage(1);
                setMovementType(value);
              }}
            >
              <SelectTrigger className="h-10 min-w-0 rounded-xl">
                <SelectValue placeholder="Movement type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All movements</SelectItem>
                {INVENTORY_MOVEMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={category}
              onValueChange={(value) => {
                setPage(1);
                setCategory(value);
              }}
            >
              <SelectTrigger className="h-10 min-w-0 rounded-xl">
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
            <div className="flex min-w-0 gap-2 sm:col-span-2 xl:col-span-2">
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setPage(1);
                  setFrom(e.target.value);
                }}
                className="h-10 min-w-0 flex-1 basis-0 rounded-xl"
              />
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setPage(1);
                  setTo(e.target.value);
                }}
                className="h-10 min-w-0 flex-1 basis-0 rounded-xl"
              />
            </div>
          </div>

          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Loading history...
            </p>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No movements found"
              description="Try adjusting filters or create a stock adjustment."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Previous</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">New</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const product =
                      row.product && typeof row.product === "object"
                        ? (row.product as {
                            name?: string;
                            sku?: string;
                          })
                        : null;
                    const performer =
                      row.performedBy && typeof row.performedBy === "object"
                        ? (row.performedBy as { name?: string; email?: string })
                        : null;

                    return (
                      <TableRow key={String(row._id)}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDateTime(row.createdAt)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {product?.name ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {product?.sku ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {String(row.movementType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(Number(row.previousStock))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(Number(row.quantity))}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatNumber(Number(row.newStock))}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {row.referenceNumber
                            ? String(row.referenceNumber)
                            : "—"}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm">
                          {String(row.reason)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {performer?.name || performer?.email || "System"}
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
    </div>
  );
}
