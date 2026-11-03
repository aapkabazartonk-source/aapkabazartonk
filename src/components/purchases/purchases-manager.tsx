"use client";

import { useEffect, useState, useEffectEvent } from "react";
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  Plus,
  Search,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { PurchaseFormSheet } from "@/components/purchases/purchase-form-sheet";
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
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { PurchaseCreateValues } from "@/lib/validators/purchase";
import type { ProductRecord } from "@/types/catalog";
import type {
  PurchaseListResponse,
  PurchaseRecord,
  PurchaseStatus,
} from "@/types/inventory";

function statusBadge(status: PurchaseStatus) {
  if (status === "RECEIVED") return <Badge variant="success">Received</Badge>;
  if (status === "CANCELLED")
    return <Badge variant="destructive">Cancelled</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

export function PurchasesManager() {
  const [rows, setRows] = useState<PurchaseRecord[]>([]);
  const [stats, setStats] = useState<PurchaseListResponse["stats"] | null>(null);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchJson<{ data: ProductRecord[] }>("/api/products?limit=100&status=active")
      .then((res) => setProducts(res.data))
      .catch(() => setProducts([]));
  }, []);

  const load = useEffectEvent(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status !== "all") params.set("status", status);

      const res = await fetchJson<PurchaseListResponse>(
        `/api/purchases?${params.toString()}`,
      );
      setRows(res.data);
      setStats(res.stats);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Failed to load purchases",
      );
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void load();
  }, [page, debouncedSearch, status]);

  async function handleCreate(values: PurchaseCreateValues) {
    setSubmitting(true);
    try {
      await fetchJson("/api/purchases", {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Purchase draft created");
      setFormOpen(false);
      setPage(1);
      await load();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Failed to create purchase",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function receivePurchase(id: string) {
    setActionId(id);
    try {
      await fetchJson(`/api/purchases/${id}/receive`, { method: "POST" });
      toast.success("Purchase received — stock updated");
      await load();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Failed to receive purchase",
      );
    } finally {
      setActionId(null);
    }
  }

  async function cancelPurchase(id: string) {
    setActionId(id);
    try {
      await fetchJson(`/api/purchases/${id}/cancel`, { method: "POST" });
      toast.success("Purchase cancelled");
      await load();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Failed to cancel purchase",
      );
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchases"
        description="Create purchase drafts, receive goods, and update inventory safely."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New purchase
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SimpleStatCard
          label="Total purchases"
          value={formatNumber(stats?.totalPurchases ?? 0)}
          icon={ClipboardList}
          index={0}
        />
        <SimpleStatCard
          label="Drafts"
          value={formatNumber(stats?.draftCount ?? 0)}
          icon={FileText}
          index={1}
        />
        <SimpleStatCard
          label="Received"
          value={formatNumber(stats?.receivedCount ?? 0)}
          icon={CheckCircle2}
          index={2}
        />
        <SimpleStatCard
          label="Cancelled"
          value={formatNumber(stats?.cancelledCount ?? 0)}
          icon={XCircle}
          index={3}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                placeholder="Search purchase #, supplier, SKU..."
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
              <SelectTrigger className="h-10 w-full rounded-xl sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="RECEIVED">Received</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Loading purchases...
            </p>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No purchases yet"
              description="Create a draft purchase, then receive it to increase stock."
              action={
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New purchase
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Purchase #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((purchase) => (
                    <TableRow key={purchase._id}>
                      <TableCell className="font-mono text-xs font-medium">
                        {purchase.purchaseNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{purchase.supplierName}</p>
                          {purchase.supplierContact ? (
                            <p className="text-xs text-muted-foreground">
                              {purchase.supplierContact}
                            </p>
                          ) : null}
                          {purchase.supplierInvoiceNumber ? (
                            <p className="font-mono text-xs text-muted-foreground">
                              Inv {purchase.supplierInvoiceNumber}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(purchase.purchaseDate)}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(purchase.items.length)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(purchase.total)}
                      </TableCell>
                      <TableCell>{statusBadge(purchase.status)}</TableCell>
                      <TableCell className="text-right">
                        {purchase.status === "DRAFT" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              disabled={actionId === purchase._id}
                              onClick={() => void receivePurchase(purchase._id)}
                            >
                              Receive
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionId === purchase._id}
                              onClick={() => void cancelPurchase(purchase._id)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {purchase.status === "RECEIVED"
                              ? `Received ${formatDate(purchase.receivedAt)}`
                              : "—"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
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

      <PurchaseFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        products={products}
        submitting={submitting}
        onSubmit={handleCreate}
      />
    </div>
  );
}
