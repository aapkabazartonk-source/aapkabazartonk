"use client";

import { useCallback, useEffect, useMemo, useState, useEffectEvent } from "react";
import {
  AlertTriangle,
  ImageIcon,
  IndianRupee,
  MoreHorizontal,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SimpleStatCard } from "@/components/shared/simple-stat-card";
import { ProductFormSheet } from "@/components/products/product-form-sheet";
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
import type { ProductFormValues } from "@/lib/validators/product";
import type {
  CategoryRecord,
  ProductListResponse,
  ProductRecord,
  StockStatus,
} from "@/types/catalog";

function categoryName(product: ProductRecord) {
  if (!product.category) return "—";
  if (typeof product.category === "string") return "—";
  return product.category.name;
}

function stockBadge(status?: StockStatus) {
  switch (status) {
    case "out_of_stock":
      return <Badge variant="destructive">Out of stock</Badge>;
    case "low_stock":
      return <Badge variant="warning">Low stock</Badge>;
    default:
      return <Badge variant="success">In stock</Badge>;
  }
}

export function ProductsManager() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [items, setItems] = useState<ProductRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    lowStockProducts: 0,
    totalInventoryValue: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [stockStatus, setStockStatus] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState("createdAt:desc");
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ProductRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductRecord | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, stockStatus, categoryFilter, sort]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const [sortField, sortOrder] = sort.split(":");
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        status,
        sort: sortField,
        order: sortOrder || "desc",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (stockStatus !== "all") params.set("stockStatus", stockStatus);
      if (categoryFilter !== "all") params.set("category", categoryFilter);

      const response = await fetchJson<ProductListResponse>(
        `/api/products?${params.toString()}`,
      );
      setItems(response.data);
      setPagination(response.pagination);
      setStats(response.stats);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Failed to load products.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, stockStatus, categoryFilter, sort]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetchJson<{ data: CategoryRecord[] }>(
        "/api/categories?flat=true&status=active",
      );
      setCategories(response.data);
    } catch {
      // Product form can still open; category dropdown may be empty.
    }
  }, []);

  const onLoad = useEffectEvent(() => {
    void loadProducts();
  });

  useEffect(() => {
    onLoad();
  }, [page, debouncedSearch, status, stockStatus, categoryFilter, sort]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const openCreate = () => {
    setMode("create");
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (product: ProductRecord) => {
    setMode("edit");
    setEditing(product);
    setSheetOpen(true);
  };

  const handleSubmit = async (values: ProductFormValues) => {
    setSubmitting(true);
    try {
      if (mode === "create") {
        await fetchJson("/api/products", {
          method: "POST",
          body: JSON.stringify(values),
        });
        toast.success("Product created.");
      } else if (editing) {
        const { currentStock: _currentStock, ...editable } = values;
        await fetchJson(`/api/products/${editing._id}`, {
          method: "PATCH",
          body: JSON.stringify(editable),
        });
        toast.success("Product updated.");
      }
      setSheetOpen(false);
      await loadProducts();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not save product.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetchJson(`/api/products/${deleteTarget._id}`, {
        method: "DELETE",
      });
      toast.success("Product deleted.");
      setDeleteTarget(null);
      await loadProducts();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not delete product.",
      );
    } finally {
      setDeleting(false);
    }
  };

  const hasFilters = useMemo(
    () =>
      Boolean(debouncedSearch) ||
      status !== "all" ||
      stockStatus !== "all" ||
      categoryFilter !== "all",
    [debouncedSearch, status, stockStatus, categoryFilter],
  );

  const parentCategoryOptions = categories.filter(
    (category) => !category.parentCategory,
  );

  return (
    <div>
      <PageHeader
        title="Products"
        description="Create and manage your product catalog with pricing, SKUs, and stock levels."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SimpleStatCard
          label="Total products"
          value={formatNumber(stats.totalProducts)}
          description="All catalog items"
          icon={Package}
          index={0}
        />
        <SimpleStatCard
          label="Active products"
          value={formatNumber(stats.activeProducts)}
          description="Ready for selling"
          icon={PackageCheck}
          index={1}
        />
        <SimpleStatCard
          label="Low stock"
          value={formatNumber(stats.lowStockProducts)}
          description="Below minimum level"
          icon={AlertTriangle}
          index={2}
        />
        <SimpleStatCard
          label="Inventory value"
          value={formatCurrency(stats.totalInventoryValue)}
          description="Stock × purchase price"
          icon={IndianRupee}
          index={3}
        />
      </div>

      <Card className="mt-6">
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, SKU, or barcode…"
                className="pl-9"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {parentCategoryOptions.map((category) => (
                    <SelectItem key={category._id} value={category._id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stockStatus} onValueChange={setStockStatus}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stock</SelectItem>
                  <SelectItem value="in_stock">In stock</SelectItem>
                  <SelectItem value="low_stock">Low stock</SelectItem>
                  <SelectItem value="out_of_stock">Out of stock</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt:desc">Newest</SelectItem>
                  <SelectItem value="createdAt:asc">Oldest</SelectItem>
                  <SelectItem value="name:asc">Name A–Z</SelectItem>
                  <SelectItem value="name:desc">Name Z–A</SelectItem>
                  <SelectItem value="sellingPrice:asc">Price ↑</SelectItem>
                  <SelectItem value="sellingPrice:desc">Price ↓</SelectItem>
                  <SelectItem value="currentStock:asc">Stock ↑</SelectItem>
                  <SelectItem value="currentStock:desc">Stock ↓</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Package}
              title={hasFilters ? "No products match your filters" : "No products yet"}
              description={
                hasFilters
                  ? "Try adjusting search, category, stock, or status filters."
                  : "Add your first product to start building the catalog."
              }
              action={
                !hasFilters ? (
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4" />
                    Add Product
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="overflow-hidden rounded-2xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="hidden md:table-cell">SKU</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Category
                      </TableHead>
                      <TableHead className="hidden xl:table-cell">
                        Purchase
                      </TableHead>
                      <TableHead>Selling</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Stock status
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((product) => (
                      <TableRow key={product._id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary">
                              {product.images?.[0] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={product.images[0]}
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">
                                {product.name}
                              </p>
                              <p className="truncate text-xs text-muted-foreground md:hidden">
                                {product.sku}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs md:table-cell">
                          {product.sku}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {categoryName(product)}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          {formatCurrency(product.purchasePrice)}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(product.sellingPrice)}
                        </TableCell>
                        <TableCell>
                          {formatNumber(product.currentStock)}{" "}
                          <span className="text-xs text-muted-foreground">
                            {product.unit}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {stockBadge(product.stockStatus)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={product.isActive ? "success" : "secondary"}
                          >
                            {product.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openEdit(product)}
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(product)}
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

      <ProductFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={mode}
        initialData={editing}
        categories={categories}
        submitting={submitting}
        onSubmit={handleSubmit}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete product?"
        description={
          deleteTarget
            ? `This will permanently delete "${deleteTarget.name}". Products with sales or purchase history cannot be deleted.`
            : ""
        }
        confirming={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
