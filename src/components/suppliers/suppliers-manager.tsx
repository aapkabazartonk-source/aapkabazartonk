"use client";

import { useCallback, useEffect, useState, useEffectEvent } from "react";
import Link from "next/link";
import {
  Banknote,
  BookOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SimpleStatCard } from "@/components/shared/simple-stat-card";
import { SupplierFormSheet } from "@/components/suppliers/supplier-form-sheet";
import { SupplierPaymentSheet } from "@/components/suppliers/supplier-payment-sheet";
import { SupplierPaymentReceipt } from "@/components/suppliers/supplier-payment-receipt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { SupplierFormValues } from "@/lib/validators/supplier";
import type { SupplierPaymentCreateValues } from "@/lib/validators/supplier-payment";
import type {
  SupplierListResponse,
  SupplierRecord,
  SupplierStats,
} from "@/types/suppliers";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function SuppliersManager() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [items, setItems] = useState<SupplierRecord[]>([]);
  const [stats, setStats] = useState<SupplierStats | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("createdAt");
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<SupplierRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupplierRecord | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<SupplierRecord | null>(
    null,
  );
  const [receipt, setReceipt] = useState<{
    supplierName: string;
    paymentNumber: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    referenceNumber?: string;
    unallocatedAmount: number;
    notes?: string;
  } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, sort]);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        sort,
        order: sort === "name" ? "asc" : "desc",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status !== "all") params.set("status", status);

      const response = await fetchJson<SupplierListResponse>(
        `/api/suppliers?${params.toString()}`,
      );
      setItems(response.data);
      setPagination(response.pagination);
      setStats(response.stats);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Failed to load suppliers.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, sort]);

  const onLoad = useEffectEvent(() => {
    void loadSuppliers();
  });

  useEffect(() => {
    onLoad();
  }, [page, debouncedSearch, status, sort]);

  function openCreate() {
    setMode("create");
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(supplier: SupplierRecord) {
    setMode("edit");
    setEditing(supplier);
    setSheetOpen(true);
  }

  async function handleSubmit(values: SupplierFormValues) {
    setSubmitting(true);
    try {
      if (mode === "create") {
        await fetchJson("/api/suppliers", {
          method: "POST",
          body: JSON.stringify(values),
        });
        toast.success("Supplier created");
      } else if (editing) {
        // Opening balance is create-only from the list UI to avoid unsafe edits.
        const { openingBalance: _openingBalance, ...rest } = values;
        await fetchJson(`/api/suppliers/${editing._id}`, {
          method: "PATCH",
          body: JSON.stringify(rest),
        });
        toast.success("Supplier updated");
      }
      setSheetOpen(false);
      await loadSuppliers();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not save supplier.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetchJson(`/api/suppliers/${deleteTarget._id}`, {
        method: "DELETE",
      });
      toast.success("Supplier deleted");
      setDeleteTarget(null);
      await loadSuppliers();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not delete supplier.",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function toggleActive(supplier: SupplierRecord) {
    try {
      await fetchJson(`/api/suppliers/${supplier._id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !supplier.isActive }),
      });
      toast.success(
        supplier.isActive ? "Supplier deactivated" : "Supplier activated",
      );
      await loadSuppliers();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not update supplier.",
      );
    }
  }

  async function handlePayment(values: SupplierPaymentCreateValues) {
    if (!paymentTarget) return;
    setPaying(true);
    try {
      const response = await fetchJson<{
        data: {
          paymentNumber: string;
          amount: number;
          paymentMethod: string;
          paymentDate: string;
          referenceNumber?: string;
          unallocatedAmount: number;
          notes?: string;
          receipt: {
            paymentNumber: string;
            amount: number;
            paymentMethod: string;
            paymentDate: string;
            referenceNumber?: string;
            unallocatedAmount: number;
            notes?: string;
          };
        };
      }>(`/api/suppliers/${paymentTarget._id}/payments`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Payment recorded");
      setReceipt({
        supplierName: paymentTarget.name,
        ...response.data.receipt,
      });
      setPaymentTarget(null);
      await loadSuppliers();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not record payment.",
      );
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Supplier directory, payables, and purchase relationships."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add supplier
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SimpleStatCard
          label="Total suppliers"
          value={formatNumber(stats?.totalSuppliers ?? 0)}
          icon={Users}
          index={0}
        />
        <SimpleStatCard
          label="Active suppliers"
          value={formatNumber(stats?.activeSuppliers ?? 0)}
          icon={Truck}
          index={1}
        />
        <SimpleStatCard
          label="Total purchases"
          value={formatNumber(stats?.totalPurchases ?? 0)}
          description={formatCurrency(stats?.purchaseValue ?? 0)}
          icon={Wallet}
          index={2}
        />
        <SimpleStatCard
          label="Outstanding payables"
          value={formatCurrency(stats?.outstandingPayables ?? 0)}
          icon={Banknote}
          index={3}
        />
      </div>

      {(stats?.topSuppliers?.length || stats?.recentTransactions?.length) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold">Top suppliers by purchase value</h3>
              <ul className="mt-4 space-y-3">
                {(stats?.topSuppliers ?? []).map((row) => (
                  <li
                    key={row._id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.purchaseCount} purchase
                        {row.purchaseCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="font-medium">
                      {formatCurrency(row.purchaseValue)}
                    </span>
                  </li>
                ))}
                {!stats?.topSuppliers?.length ? (
                  <li className="text-sm text-muted-foreground">
                    No received purchases yet.
                  </li>
                ) : null}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold">Recent supplier payments</h3>
              <ul className="mt-4 space-y-3">
                {(stats?.recentTransactions ?? []).map((row) => (
                  <li
                    key={row._id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {row.supplier?.name ?? "Supplier"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.paymentNumber} · {formatDate(row.paymentDate)}
                      </p>
                    </div>
                    <span className="font-medium">
                      {formatCurrency(row.amount)}
                    </span>
                  </li>
                ))}
                {!stats?.recentTransactions?.length ? (
                  <li className="text-sm text-muted-foreground">
                    No payments recorded yet.
                  </li>
                ) : null}
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name, phone, or GSTIN"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full rounded-xl sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-full rounded-xl sm:w-44">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Newest</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="currentBalance">Balance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No suppliers yet"
              description="Add suppliers to link purchases and track payables."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add supplier
                </Button>
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>GSTIN</TableHead>
                      <TableHead className="text-right">Payable</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((supplier) => (
                      <TableRow key={supplier._id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{supplier.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {supplier.contactPerson ||
                                supplier.city ||
                                "—"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{supplier.phone}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {supplier.gstin || "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(supplier.currentBalance)}
                        </TableCell>
                        <TableCell>
                          {supplier.isActive ? (
                            <Badge variant="success">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(supplier)}>
                                <Pencil className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/dashboard/suppliers/${supplier._id}/ledger`}
                                >
                                  <BookOpen className="h-4 w-4" />
                                  Ledger
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setPaymentTarget(supplier)}
                              >
                                <Banknote className="h-4 w-4" />
                                Record payment
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => void toggleActive(supplier)}
                              >
                                {supplier.isActive
                                  ? "Deactivate"
                                  : "Activate"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteTarget(supplier)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <PaginationControls
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <SupplierFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={mode}
        initialData={editing}
        allowOpeningBalanceEdit={mode === "create"}
        submitting={submitting}
        onSubmit={handleSubmit}
      />

      <SupplierPaymentSheet
        open={Boolean(paymentTarget)}
        onOpenChange={(open) => {
          if (!open) setPaymentTarget(null);
        }}
        supplierName={paymentTarget?.name ?? ""}
        outstanding={paymentTarget?.currentBalance ?? 0}
        submitting={paying}
        onSubmit={handlePayment}
      />

      <SupplierPaymentReceipt
        open={Boolean(receipt)}
        onOpenChange={(open) => {
          if (!open) setReceipt(null);
        }}
        receipt={receipt}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete supplier?"
        description={
          deleteTarget
            ? `Delete "${deleteTarget.name}"? Suppliers with purchase or payment history cannot be deleted.`
            : ""
        }
        confirming={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
