"use client";

import { useCallback, useEffect, useState, useEffectEvent } from "react";
import Link from "next/link";
import {
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SimpleStatCard } from "@/components/shared/simple-stat-card";
import { CustomerFormSheet } from "@/components/customers/customer-form-sheet";
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
import type { CustomerFormValues } from "@/lib/validators/customer";
import type {
  CustomerListResponse,
  CustomerRecord,
  CustomerStats,
} from "@/types/customers";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function customerTypeLabel(value: string) {
  return value === "BUSINESS" ? "Business" : "Individual";
}

export function CustomersManager() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [items, setItems] = useState<CustomerRecord[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState("createdAt");
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<CustomerRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerRecord | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = search.trim();
      setDebouncedSearch((current) => {
        if (current !== next) setPage(1);
        return next;
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadCustomers = useCallback(async () => {
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

      const response = await fetchJson<CustomerListResponse>(
        `/api/customers?${params.toString()}`,
      );
      setItems(response.data);
      setPagination(response.pagination);
      setStats(response.stats);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Failed to load customers.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, sort]);

  const onLoad = useEffectEvent(() => {
    void loadCustomers();
  });

  useEffect(() => {
    onLoad();
  }, [page, debouncedSearch, status, sort]);

  function openCreate() {
    setMode("create");
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(customer: CustomerRecord) {
    setMode("edit");
    setEditing(customer);
    setSheetOpen(true);
  }

  async function handleSubmit(values: CustomerFormValues) {
    setSubmitting(true);
    try {
      if (mode === "create") {
        await fetchJson("/api/customers", {
          method: "POST",
          body: JSON.stringify(values),
        });
        toast.success("Customer created");
      } else if (editing) {
        await fetchJson(`/api/customers/${editing._id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        toast.success("Customer updated");
      }
      setSheetOpen(false);
      await loadCustomers();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not save customer.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetchJson<{
        data: { softDeleted?: boolean };
        message?: string;
      }>(`/api/customers/${deleteTarget._id}`, {
        method: "DELETE",
      });
      toast.success(
        response.message ||
          (response.data.softDeleted
            ? "Customer deactivated"
            : "Customer deleted"),
      );
      setDeleteTarget(null);
      await loadCustomers();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not delete customer.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Customer directory linked to POS billing and invoices."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SimpleStatCard
          label="Total customers"
          value={formatNumber(stats?.totalCustomers ?? 0)}
          icon={Users}
          index={0}
        />
        <SimpleStatCard
          label="New customers this month"
          value={formatNumber(stats?.newCustomersThisMonth ?? 0)}
          icon={UserPlus}
          index={1}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name, phone, or email"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setPage(1);
                setStatus(value);
              }}
            >
              <SelectTrigger className="w-full rounded-xl sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sort}
              onValueChange={(value) => {
                setPage(1);
                setSort(value);
              }}
            >
              <SelectTrigger className="w-full rounded-xl sm:w-44">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Newest</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="customerType">Type</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No customers yet"
              description="Add a customer or create one from POS during billing."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add Customer
                </Button>
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Mobile Number</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Customer Type</TableHead>
                    <TableHead>Total Purchases</TableHead>
                    <TableHead>Last Purchase</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((customer) => (
                    <TableRow key={customer._id}>
                      <TableCell>
                        <div>
                          <Link
                            href={`/dashboard/customers/${customer._id}`}
                            className="font-medium text-foreground hover:text-primary"
                          >
                            {customer.name}
                          </Link>
                          {!customer.isActive ? (
                            <Badge variant="secondary" className="ml-2">
                              Inactive
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{customer.phone}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {customer.email || "—"}
                      </TableCell>
                      <TableCell>
                        {customerTypeLabel(customer.customerType)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {formatNumber(customer.totalPurchases ?? 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(customer.totalAmountSpent ?? 0)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(customer.lastPurchaseAt)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/customers/${customer._id}`}>
                                <Eye className="h-4 w-4" />
                                View
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(customer)}>
                              <Pencil className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(customer)}
                              className="text-destructive focus:text-destructive"
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

      <CustomerFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={mode}
        initialData={editing}
        submitting={submitting}
        onSubmit={handleSubmit}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete customer?"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.name}? If this customer has sales history, the record will be deactivated so invoices stay intact.`
            : ""
        }
        confirming={deleting}
        onConfirm={() => {
          void handleDelete();
        }}
      />
    </div>
  );
}
